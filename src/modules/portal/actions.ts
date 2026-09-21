"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { notifyByPermission } from "@/core/notifications/create";

const nn = (v?: string | null) => (v && v !== "" ? v : null);

async function myEmployeeId(): Promise<string | null> {
  const user = await requirePermission("portal.self");
  return user.employeeId;
}

export async function createLeaveRequestAction(_prev: unknown, formData: FormData) {
  const employeeId = await myEmployeeId();
  if (!employeeId) return { ok: false as const, error: "Compte non relié à un salarié." };
  const kind = String(formData.get("kind") ?? "repos") === "absence" ? "absence" : "repos";
  const from = String(formData.get("dateFrom") ?? "");
  const to = String(formData.get("dateTo") ?? "");
  if (!from || !to) return { ok: false as const, error: "Dates requises." };
  if (to < from) return { ok: false as const, error: "La date de fin doit être après le début." };

  const admin = createAdminClient();
  await admin.from("leave_requests").insert({
    employee_id: employeeId, kind, date_from: from, date_to: to,
    reason: nn(String(formData.get("reason") ?? "")), status: "pending",
  });
  await notifyByPermission("employees.view", {
    type: "leave.request",
    title: "🔔 Nouvelle demande de repos/absence",
    body: `Demande du ${from} au ${to}.`,
  });
  await writeAudit({ userId: null, action: "portal.leave_request", entityType: "employee", entityId: employeeId });
  revalidatePath("/portail/demandes");
  return { ok: true as const };
}

export async function createMaterialRequestAction(_prev: unknown, formData: FormData) {
  const employeeId = await myEmployeeId();
  if (!employeeId) return { ok: false as const, error: "Compte non relié à un salarié." };
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { ok: false as const, error: "Description requise." };
  const qty = Math.max(1, Number(formData.get("qty") ?? 1));

  const admin = createAdminClient();
  await admin.from("material_requests").insert({ employee_id: employeeId, label, qty, status: "pending" });
  await notifyByPermission("employees.view", {
    type: "material.request",
    title: "🔔 Nouvelle demande de matériel",
    body: `${qty} × ${label}`,
  });
  await writeAudit({ userId: null, action: "portal.material_request", entityType: "employee", entityId: employeeId });
  revalidatePath("/portail/demandes");
  return { ok: true as const };
}
