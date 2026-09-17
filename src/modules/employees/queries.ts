import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import type { Employee, Workday } from "./schema";
import { WORKDAY_PAID_STATUSES } from "./schema";

export async function listEmployees(types?: string[]): Promise<Employee[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("employees")
    .select("*")
    .is("deleted_at", null)
    .order("last_name");
  if (types && types.length) q = q.in("type", types);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Employee[];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("employees").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  return (data as Employee) ?? null;
}

export async function listWorkdays(employeeId: string): Promise<Workday[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("ephemeral_workdays")
    .select("id, employee_id, project_id, date, fraction, status")
    .eq("employee_id", employeeId)
    .order("date", { ascending: false });
  return (data ?? []) as Workday[];
}

/** Total de journées validées + rémunération correspondante (CDC §6). */
export function workdaySummary(workdays: Workday[], dailyRateCents: number | null) {
  const validated = workdays
    .filter((w) => WORKDAY_PAID_STATUSES.includes(w.status))
    .reduce((sum, w) => sum + Number(w.fraction), 0);
  const pending = workdays
    .filter((w) => !WORKDAY_PAID_STATUSES.includes(w.status))
    .reduce((sum, w) => sum + Number(w.fraction), 0);
  const pay = Math.round(validated * (dailyRateCents ?? 0));
  return { validated, pending, payCents: pay };
}

/** Éphémères avec leur total validé + rémunération (pour la liste). */
export async function listEphemeralsWithTotals() {
  const supabase = await createServerClient();
  const { data: emps } = await supabase
    .from("employees")
    .select("*")
    .eq("type", "ephemere")
    .is("deleted_at", null)
    .order("last_name");
  const employees = (emps ?? []) as Employee[];
  const { data: wds } = await supabase
    .from("ephemeral_workdays")
    .select("employee_id, fraction, status");
  const rows = (wds ?? []) as { employee_id: string; fraction: number; status: string }[];

  return employees.map((e) => {
    const own = rows.filter((r) => r.employee_id === e.id);
    const summary = workdaySummary(own.map((r) => ({ ...r, id: "", project_id: null, date: "" })) as Workday[], e.daily_rate_cents);
    return { employee: e, ...summary };
  });
}
