import "server-only";
import { createAdminClient } from "@/core/supabase/admin";

/**
 * Requêtes du portail salarié. Toutes filtrent STRICTEMENT sur l'employeeId de
 * la session (passé par la page après requirePermission('portal.self')), donc
 * un salarié ne peut jamais accéder aux données d'un autre.
 */

export async function getMyEmployee(employeeId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("employees")
    .select("id, first_name, last_name, type, email, phone, daily_rate_cents")
    .eq("id", employeeId)
    .maybeSingle();
  return data as { id: string; first_name: string; last_name: string; type: string; email: string | null; phone: string | null; daily_rate_cents: number | null } | null;
}

export async function getMyPlanning(employeeId: string) {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: assigns } = await admin
    .from("schedule_assignments")
    .select("schedule:schedules(id, date, start_time, end_time, notes, project:projects(reference, address, client:clients(name)))")
    .eq("employee_id", employeeId);

  const rows = ((assigns ?? []) as unknown[]).map((a) => {
    const sc = (a as { schedule: unknown }).schedule;
    const s = Array.isArray(sc) ? sc[0] : sc;
    return s as { id: string; date: string; start_time: string; end_time: string; notes: string | null; project: unknown } | null;
  }).filter(Boolean) as { id: string; date: string; start_time: string; end_time: string; notes: string | null; project: unknown }[];

  return rows
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .map((s) => {
      const p = Array.isArray(s.project) ? s.project[0] : s.project;
      const proj = p as { reference: string | null; address: string | null; client: unknown } | null;
      const client = proj ? (Array.isArray(proj.client) ? proj.client[0] : proj.client) : null;
      return {
        id: s.id, date: s.date, startTime: s.start_time, endTime: s.end_time, notes: s.notes,
        projectRef: proj?.reference ?? null, address: proj?.address ?? null,
        clientName: (client as { name: string } | null)?.name ?? null,
      };
    });
}

export async function getMyLeaveRequests(employeeId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("leave_requests")
    .select("id, kind, date_from, date_to, reason, status, created_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  return (data ?? []) as { id: string; kind: string; date_from: string; date_to: string; reason: string | null; status: string; created_at: string }[];
}

export async function getMyMaterialRequests(employeeId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("material_requests")
    .select("id, label, qty, status, created_at, project:projects(reference)")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as { id: string; label: string; qty: number; status: string; created_at: string; project: unknown };
    const p = Array.isArray(row.project) ? row.project[0] : row.project;
    return { ...row, projectRef: (p as { reference: string | null } | null)?.reference ?? null };
  });
}

export async function getMyPayslips(employeeId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payslips")
    .select("id, year, month, label, net_cents, storage_path")
    .eq("employee_id", employeeId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  return (data ?? []) as { id: string; year: number; month: number; label: string | null; net_cents: number | null; storage_path: string | null }[];
}
