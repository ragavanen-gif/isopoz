"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { PROJECT_TRANSITIONS, PROJECT_STATUS_LABELS, type ProjectStatus } from "./constants";
import { toCents } from "@/lib/format";

const nn = (v?: string | null) => (v && v !== "" ? v : null);

async function logEvent(projectId: string, userId: string, type: string, message: string) {
  const admin = createAdminClient();
  await admin.from("project_events").insert({ project_id: projectId, user_id: userId, type, message });
}

/** Crée un chantier à partir d'un devis accepté (règles 4 & 5). */
export async function createProjectFromQuoteAction(quoteId: string) {
  const user = await requirePermission("projects.create");
  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("quotes")
    .select("id, client_id, status, subject, total_cents, project_id, client:clients(address, postal_code, city)")
    .eq("id", quoteId)
    .single();
  if (!quote) throw new Error("Devis introuvable.");
  if (quote.status !== "accepte") throw new Error("Le devis doit être accepté pour générer un chantier.");
  if (quote.project_id) redirect(`/chantiers/${quote.project_id}`);

  const client = (Array.isArray(quote.client) ? quote.client[0] : quote.client) as { address: string | null; postal_code: string | null; city: string | null } | null;
  const year = new Date().getFullYear();
  const { data: reference } = await admin.rpc("next_reference", { p_scope: "project", p_prefix: "CH", p_year: year });

  const { data: project, error } = await admin
    .from("projects")
    .insert({
      reference,
      client_id: quote.client_id,
      quote_id: quote.id,
      address: [client?.address, client?.postal_code, client?.city].filter(Boolean).join(", ") || null,
      description: quote.subject,
      quote_total_cents: quote.total_cents,
      manager_id: user.id,
      status: "a_planifier",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !project) throw new Error(error?.message ?? "Échec de création du chantier.");

  await admin.from("quotes").update({ project_id: project.id }).eq("id", quoteId);
  await logEvent(project.id, user.id, "created", "Chantier créé à partir du devis accepté");
  await writeAudit({ userId: user.id, action: "project.create_from_quote", entityType: "project", entityId: project.id, after: { quoteId } });
  revalidatePath("/chantiers");
  redirect(`/chantiers/${project.id}`);
}

export async function updateProjectAction(id: string, formData: FormData) {
  const user = await requirePermission("projects.edit");
  const admin = createAdminClient();
  await admin.from("projects").update({
    address: nn(String(formData.get("address") ?? "")),
    start_date: nn(String(formData.get("startDate") ?? "")),
    end_date_planned: nn(String(formData.get("endDatePlanned") ?? "")),
    end_date_actual: nn(String(formData.get("endDateActual") ?? "")),
    description: nn(String(formData.get("description") ?? "")),
    notes: nn(String(formData.get("notes") ?? "")),
  }).eq("id", id);
  await writeAudit({ userId: user.id, action: "project.update", entityType: "project", entityId: id });
  revalidatePath(`/chantiers/${id}`);
}

export async function setProjectStatusAction(id: string, next: ProjectStatus) {
  const user = await requirePermission("projects.edit");
  const admin = createAdminClient();
  const { data: cur } = await admin.from("projects").select("status").eq("id", id).single();
  const from = cur?.status as ProjectStatus | undefined;
  if (from && !PROJECT_TRANSITIONS[from].includes(next)) {
    throw new Error(`Transition invalide : ${from} → ${next}`);
  }
  const patch: Record<string, unknown> = { status: next };
  if (next === "termine") patch.end_date_actual = new Date().toISOString().slice(0, 10);
  await admin.from("projects").update(patch).eq("id", id);
  await logEvent(id, user.id, "status", `Statut : ${PROJECT_STATUS_LABELS[next]}`);
  await writeAudit({ userId: user.id, action: `project.status.${next}`, entityType: "project", entityId: id, before: { status: from } });
  revalidatePath(`/chantiers/${id}`);
  revalidatePath("/chantiers");
}

export async function assignEmployeeAction(projectId: string, formData: FormData) {
  const user = await requirePermission("projects.edit");
  const employeeId = String(formData.get("employeeId") ?? "");
  const role = nn(String(formData.get("roleOnSite") ?? ""));
  if (!employeeId) return;
  const admin = createAdminClient();
  const { error } = await admin.from("project_employees").insert({ project_id: projectId, employee_id: employeeId, role_on_site: role });
  if (!error) {
    const { data: emp } = await admin.from("employees").select("first_name, last_name").eq("id", employeeId).single();
    await logEvent(projectId, user.id, "team", `Salarié affecté : ${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`);
  }
  revalidatePath(`/chantiers/${projectId}`);
}

export async function removeProjectEmployeeAction(projectId: string, peId: string) {
  await requirePermission("projects.edit");
  const admin = createAdminClient();
  await admin.from("project_employees").delete().eq("id", peId);
  revalidatePath(`/chantiers/${projectId}`);
}

/** Réservation de matériel avec contrôle de disponibilité (CDC §18). */
export async function reserveEquipmentAction(projectId: string, _prev: unknown, formData: FormData) {
  const user = await requirePermission("projects.edit");
  const equipmentId = String(formData.get("equipmentId") ?? "");
  const qty = Math.max(1, Number(formData.get("qty") ?? 1));
  const from = nn(String(formData.get("reservedFrom") ?? ""));
  const to = nn(String(formData.get("reservedTo") ?? ""));
  if (!equipmentId) return { ok: false as const, error: "Matériel requis." };

  const admin = createAdminClient();
  const { data: eq } = await admin.from("equipment").select("quantity, name").eq("id", equipmentId).single();
  if (!eq) return { ok: false as const, error: "Matériel introuvable." };

  // Disponibilité : quantité − réservations chevauchantes.
  let reservedElsewhere = 0;
  if (from && to) {
    const { data: overlaps } = await admin
      .from("project_equipment")
      .select("qty, reserved_from, reserved_to, status")
      .eq("equipment_id", equipmentId)
      .eq("status", "reserved");
    reservedElsewhere = ((overlaps ?? []) as { qty: number; reserved_from: string | null; reserved_to: string | null }[])
      .filter((o) => o.reserved_from && o.reserved_to && o.reserved_from <= to && o.reserved_to >= from)
      .reduce((s, o) => s + o.qty, 0);
  }
  if (from && to && reservedElsewhere + qty > eq.quantity) {
    return { ok: false as const, error: `Disponibilité insuffisante : ${eq.quantity - reservedElsewhere} sur ${eq.quantity} disponible(s) sur cette période.` };
  }

  await admin.from("project_equipment").insert({ project_id: projectId, equipment_id: equipmentId, qty, reserved_from: from, reserved_to: to, status: "reserved" });
  await logEvent(projectId, user.id, "equipment", `Matériel réservé : ${eq.name} ×${qty}`);
  revalidatePath(`/chantiers/${projectId}`);
  return { ok: true as const };
}

export async function removeReservationAction(projectId: string, reservationId: string) {
  await requirePermission("projects.edit");
  const admin = createAdminClient();
  await admin.from("project_equipment").delete().eq("id", reservationId);
  revalidatePath(`/chantiers/${projectId}`);
}

export async function addCostAction(projectId: string, formData: FormData) {
  const user = await requirePermission("projects.edit");
  const category = String(formData.get("category") ?? "other");
  const label = String(formData.get("label") ?? "").trim();
  const amount = String(formData.get("amount") ?? "");
  const incurredAt = nn(String(formData.get("incurredAt") ?? ""));
  if (!label || !amount) return;
  const admin = createAdminClient();
  await admin.from("project_costs").insert({
    project_id: projectId, category, label, amount_cents: toCents(amount),
    incurred_at: incurredAt ?? new Date().toISOString().slice(0, 10), created_by: user.id,
  });
  await writeAudit({ userId: user.id, action: "project.cost.add", entityType: "project", entityId: projectId, after: { label, amount } });
  revalidatePath(`/chantiers/${projectId}`);
}

export async function deleteCostAction(projectId: string, costId: string) {
  await requirePermission("projects.edit");
  const admin = createAdminClient();
  await admin.from("project_costs").delete().eq("id", costId);
  revalidatePath(`/chantiers/${projectId}`);
}

export async function deleteProjectAction(id: string) {
  const user = await requirePermission("projects.delete");
  const admin = createAdminClient();
  await admin.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await writeAudit({ userId: user.id, action: "project.delete", entityType: "project", entityId: id });
  revalidatePath("/chantiers");
  redirect("/chantiers");
}
