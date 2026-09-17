import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import type { ProjectStatus } from "./constants";

export type Project = {
  id: string;
  reference: string | null;
  client_id: string;
  quote_id: string | null;
  address: string | null;
  start_date: string | null;
  end_date_planned: string | null;
  end_date_actual: string | null;
  status: ProjectStatus;
  description: string | null;
  notes: string | null;
  quote_total_cents: number;
  team_lead_id: string | null;
};

export type ProjectRow = Project & {
  client: { id: string; name: string } | null;
  quote: { id: string; reference: string | null } | null;
};

export async function listProjects(status?: string): Promise<ProjectRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("projects")
    .select("*, client:clients(id, name), quote:quotes(id, reference)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectRow[];
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("projects")
    .select("*, client:clients(id, name), quote:quotes(id, reference)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as unknown as ProjectRow) ?? null;
}

export async function getProjectEmployees(projectId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("project_employees")
    .select("id, role_on_site, employee:employees(id, first_name, last_name, type)")
    .eq("project_id", projectId);
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as { id: string; role_on_site: string | null; employee: { id: string; first_name: string; last_name: string; type: string } | { id: string; first_name: string; last_name: string; type: string }[] | null };
    const emp = Array.isArray(row.employee) ? row.employee[0] : row.employee;
    return { id: row.id, roleOnSite: row.role_on_site, employee: emp };
  });
}

export async function getProjectEquipment(projectId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("project_equipment")
    .select("id, qty, reserved_from, reserved_to, status, equipment:equipment(id, name)")
    .eq("project_id", projectId);
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as { id: string; qty: number; reserved_from: string | null; reserved_to: string | null; status: string; equipment: { id: string; name: string } | { id: string; name: string }[] | null };
    const eq = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
    return { id: row.id, qty: row.qty, reservedFrom: row.reserved_from, reservedTo: row.reserved_to, status: row.status, equipment: eq };
  });
}

export type Cost = { id: string; category: string; label: string; amount_cents: number; incurred_at: string };

export async function getProjectCosts(projectId: string): Promise<Cost[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("project_costs")
    .select("id, category, label, amount_cents, incurred_at")
    .eq("project_id", projectId)
    .order("incurred_at", { ascending: false });
  return (data ?? []) as Cost[];
}

export async function getProjectEvents(projectId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("project_events")
    .select("id, at, type, message")
    .eq("project_id", projectId)
    .order("at", { ascending: false });
  return (data ?? []) as { id: string; at: string; type: string; message: string }[];
}

/** Facture liée à un chantier (règle 6), s'il en existe une. */
export async function getProjectInvoice(projectId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, reference, status")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; reference: string | null; status: string } | null) ?? null;
}

/** Marge = montant devis figé − Σ coûts réels (CDC §20). */
export function computeMargin(quoteTotalCents: number, costs: Cost[]) {
  const totalCost = costs.reduce((s, c) => s + c.amount_cents, 0);
  const margin = quoteTotalCents - totalCost;
  const rate = quoteTotalCents > 0 ? Math.round((margin / quoteTotalCents) * 100) : 0;
  return { totalCost, margin, rate };
}
