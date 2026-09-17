import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import type { Client } from "./schema";

/** Liste des clients (soumise aux RLS via la session utilisateur). */
export async function listClients(search?: string): Promise<Client[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("clients")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},city.ilike.${term},reference.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as Client) ?? null;
}

export type ClientContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

export async function getClientContacts(clientId: string): Promise<ClientContact[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("client_contacts")
    .select("id, name, role, email, phone, is_primary")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false });
  return (data ?? []) as ClientContact[];
}

/**
 * Synthèse client (dashboard). Les compteurs commerciaux (devis, demandes) sont
 * branchés dès la Phase 2 ; les agrégats CA/factures/chantiers viendront en
 * Phases 3-4 (on ne mélange pas CA facturé et trésorerie — cf. docs/00).
 */
export async function getClientDashboard(clientId: string) {
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const [quotes, requests, projects, invRes, payRes] = await Promise.all([
    supabase.from("quotes").select("*", { count: "exact", head: true }).eq("client_id", clientId).is("deleted_at", null),
    supabase.from("customer_requests").select("*", { count: "exact", head: true }).eq("client_id", clientId).is("deleted_at", null),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("client_id", clientId).is("deleted_at", null),
    supabase.from("invoices").select("id, total_cents, due_date, status").eq("client_id", clientId).is("deleted_at", null),
    supabase.from("payments").select("amount_cents, invoice_id, invoices!inner(client_id)").eq("invoices.client_id", clientId),
  ]);

  const invoices = (invRes.data ?? []) as { id: string; total_cents: number; due_date: string | null; status: string }[];
  const billable = invoices.filter((i) => i.status !== "brouillon" && i.status !== "annulee");
  const paidByInv = new Map<string, number>();
  for (const p of (payRes.data ?? []) as { amount_cents: number; invoice_id: string }[]) {
    paidByInv.set(p.invoice_id, (paidByInv.get(p.invoice_id) ?? 0) + p.amount_cents);
  }
  const caTotal = billable.reduce((s, i) => s + i.total_cents, 0);
  let pending = 0, overdue = 0;
  for (const i of billable) {
    const remaining = i.total_cents - (paidByInv.get(i.id) ?? 0);
    if (remaining <= 0) continue;
    if (i.due_date && i.due_date < today) overdue += remaining;
    else pending += remaining;
  }

  return {
    caTotal,
    invoicesPending: pending,
    invoicesOverdue: overdue,
    projectsCount: projects.count ?? 0,
    quotesCount: quotes.count ?? 0,
    requestsCount: requests.count ?? 0,
  };
}
