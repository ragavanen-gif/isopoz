"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";

export async function createScheduleAction(_prev: unknown, formData: FormData) {
  const user = await requirePermission("planning.create");
  const projectId = String(formData.get("projectId") ?? "");
  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("startTime") ?? "08:00");
  const end = String(formData.get("endTime") ?? "17:00");
  if (!projectId || !date) return { ok: false as const, error: "Chantier et date requis." };
  if (start >= end) return { ok: false as const, error: "L'heure de fin doit être après le début." };

  const admin = createAdminClient();
  const { error } = await admin.from("schedules").insert({
    project_id: projectId, date, start_time: start, end_time: end, created_by: user.id,
  });
  if (error) return { ok: false as const, error: error.message };
  await writeAudit({ userId: user.id, action: "schedule.create", entityType: "schedule", entityId: projectId, after: { date } });
  revalidatePath("/planning");
  return { ok: true as const };
}

/** Affecte un salarié à un créneau, avec détection de conflit (CDC §16). */
export async function assignToScheduleAction(scheduleId: string, _prev: unknown, formData: FormData) {
  const user = await requirePermission("planning.edit");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return { ok: false as const, error: "Salarié requis." };

  const admin = createAdminClient();
  const { data: sched } = await admin.from("schedules").select("date, start_time, end_time").eq("id", scheduleId).single();
  if (!sched) return { ok: false as const, error: "Créneau introuvable." };

  const { data: conflicts } = await admin.rpc("schedule_conflicts", {
    p_employee_id: employeeId,
    p_date: sched.date,
    p_start: sched.start_time,
    p_end: sched.end_time,
    p_exclude_schedule: scheduleId,
  });
  if (Array.isArray(conflicts) && conflicts.length > 0) {
    const c = conflicts[0] as { project_reference: string; start_time: string; end_time: string };
    return { ok: false as const, error: `⚠ Conflit : déjà affecté au chantier ${c.project_reference} le ${sched.date} (${c.start_time?.slice(0,5)}–${c.end_time?.slice(0,5)}).` };
  }

  const { error } = await admin.from("schedule_assignments").insert({ schedule_id: scheduleId, employee_id: employeeId });
  if (error) return { ok: false as const, error: error.message };
  await writeAudit({ userId: user.id, action: "schedule.assign", entityType: "schedule", entityId: scheduleId, after: { employeeId } });
  revalidatePath("/planning");
  return { ok: true as const };
}

export async function removeAssignmentAction(assignmentId: string) {
  await requirePermission("planning.edit");
  const admin = createAdminClient();
  await admin.from("schedule_assignments").delete().eq("id", assignmentId);
  revalidatePath("/planning");
}

export async function deleteScheduleAction(scheduleId: string) {
  await requirePermission("planning.edit");
  const admin = createAdminClient();
  await admin.from("schedules").delete().eq("id", scheduleId);
  revalidatePath("/planning");
}
