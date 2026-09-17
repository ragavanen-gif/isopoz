import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";

export type ScheduleAssignment = { id: string; employee: { id: string; first_name: string; last_name: string } | null };
export type ScheduleRow = {
  id: string;
  project_id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  project: { id: string; reference: string | null; client: { name: string } | null } | null;
  assignments: ScheduleAssignment[];
};

export async function listSchedules(): Promise<ScheduleRow[]> {
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: schedules } = await supabase
    .from("schedules")
    .select("id, project_id, date, start_time, end_time, notes, project:projects(id, reference, client:clients(name))")
    .gte("date", today)
    .order("date")
    .order("start_time");

  const scheduleIds = (schedules ?? []).map((s) => (s as { id: string }).id);
  const assignBySchedule = new Map<string, ScheduleAssignment[]>();
  if (scheduleIds.length) {
    const { data: assigns } = await supabase
      .from("schedule_assignments")
      .select("id, schedule_id, employee:employees(id, first_name, last_name)")
      .in("schedule_id", scheduleIds)
      .not("employee_id", "is", null);
    for (const a of (assigns ?? []) as unknown[]) {
      const row = a as { id: string; schedule_id: string; employee: unknown };
      const emp = Array.isArray(row.employee) ? row.employee[0] : row.employee;
      const arr = assignBySchedule.get(row.schedule_id) ?? [];
      arr.push({ id: row.id, employee: (emp as ScheduleAssignment["employee"]) ?? null });
      assignBySchedule.set(row.schedule_id, arr);
    }
  }

  return ((schedules ?? []) as unknown[]).map((s) => {
    const row = s as Omit<ScheduleRow, "project" | "assignments"> & { project: unknown };
    const proj = Array.isArray(row.project) ? row.project[0] : row.project;
    const project = proj
      ? { ...(proj as { id: string; reference: string | null; client: unknown }), client: Array.isArray((proj as { client: unknown }).client) ? (proj as { client: unknown[] }).client[0] : (proj as { client: unknown }).client }
      : null;
    return { ...row, project: project as ScheduleRow["project"], assignments: assignBySchedule.get(row.id) ?? [] };
  });
}
