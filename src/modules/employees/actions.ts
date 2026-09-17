"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { employeeSchema } from "./schema";
import { toCents } from "@/lib/format";

type Result = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const nn = (v?: string | null) => (v && v !== "" ? v : null);

function parse(formData: FormData) {
  return employeeSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    type: formData.get("type"),
    dailyRate: formData.get("dailyRate"),
    notes: formData.get("notes"),
  });
}

function toDb(d: import("./schema").EmployeeInput) {
  return {
    first_name: d.firstName.trim(),
    last_name: d.lastName.trim(),
    email: nn(d.email),
    phone: nn(d.phone),
    type: d.type,
    daily_rate_cents: d.type === "ephemere" && d.dailyRate ? toCents(d.dailyRate) : null,
    notes: nn(d.notes),
  };
}

export async function createEmployeeAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("employees.create");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Formulaire invalide.", fieldErrors: fe };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("employees").insert({ ...toDb(parsed.data), created_by: user.id }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Échec." };
  await writeAudit({ userId: user.id, action: "employee.create", entityType: "employee", entityId: data.id });
  revalidatePath("/personnel/salaries");
  revalidatePath("/personnel/ephemeres");
  redirect(`/personnel/salaries/${data.id}`);
}

export async function updateEmployeeAction(id: string, _prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("employees.edit");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Formulaire invalide.", fieldErrors: fe };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("employees").update(toDb(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({ userId: user.id, action: "employee.update", entityType: "employee", entityId: id });
  revalidatePath(`/personnel/salaries/${id}`);
  redirect(`/personnel/salaries/${id}`);
}

export async function deleteEmployeeAction(id: string) {
  const user = await requirePermission("employees.delete");
  const admin = createAdminClient();
  await admin.from("employees").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await writeAudit({ userId: user.id, action: "employee.delete", entityType: "employee", entityId: id });
  revalidatePath("/personnel/salaries");
  redirect("/personnel/salaries");
}

// ---- Journées éphémères ----

export async function addWorkdayAction(employeeId: string, formData: FormData) {
  const user = await requirePermission("ephemeral.create");
  const date = String(formData.get("date") ?? "");
  const fraction = Number(formData.get("fraction") ?? 1);
  if (!date) return;
  const admin = createAdminClient();
  await admin.from("ephemeral_workdays").insert({
    employee_id: employeeId,
    date,
    fraction: fraction === 0.5 ? 0.5 : 1.0,
    status: "planifiee",
    created_by: user.id,
  });
  await writeAudit({ userId: user.id, action: "workday.add", entityType: "employee", entityId: employeeId, after: { date, fraction } });
  revalidatePath(`/personnel/salaries/${employeeId}`);
}

export async function setWorkdayStatusAction(employeeId: string, workdayId: string, status: string) {
  // Valider requiert la permission dédiée.
  if (status === "validee") await requirePermission("ephemeral.validate");
  const user = await requirePermission("ephemeral.edit");
  const admin = createAdminClient();
  const patch: Record<string, unknown> = { status };
  if (status === "validee") patch.validated_by = user.id;
  await admin.from("ephemeral_workdays").update(patch).eq("id", workdayId);
  await writeAudit({ userId: user.id, action: `workday.${status}`, entityType: "workday", entityId: workdayId });
  revalidatePath(`/personnel/salaries/${employeeId}`);
}

export async function deleteWorkdayAction(employeeId: string, workdayId: string) {
  const user = await requirePermission("ephemeral.edit");
  const admin = createAdminClient();
  await admin.from("ephemeral_workdays").delete().eq("id", workdayId);
  await writeAudit({ userId: user.id, action: "workday.delete", entityType: "workday", entityId: workdayId });
  revalidatePath(`/personnel/salaries/${employeeId}`);
}
