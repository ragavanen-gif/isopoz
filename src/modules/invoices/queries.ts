import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import { effectiveStatus, type InvoiceStatus } from "./constants";

export type Invoice = {
  id: string;
  reference: string | null;
  client_id: string;
  quote_id: string | null;
  project_id: string | null;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  payment_terms: string | null;
  notes: string | null;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
};

export type InvoiceRow = Invoice & {
  client: { id: string; name: string } | null;
  paid_cents: number;
  effective_status: InvoiceStatus;
};

async function paidByInvoice(supabase: Awaited<ReturnType<typeof createServerClient>>, invoiceIds: string[]) {
  const map = new Map<string, number>();
  if (!invoiceIds.length) return map;
  const { data } = await supabase.from("payments").select("invoice_id, amount_cents").in("invoice_id", invoiceIds);
  for (const p of (data ?? []) as { invoice_id: string; amount_cents: number }[]) {
    map.set(p.invoice_id, (map.get(p.invoice_id) ?? 0) + p.amount_cents);
  }
  return map;
}

export async function listInvoices(status?: string): Promise<InvoiceRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, client:clients(id, name)")
    .is("deleted_at", null)
    .order("issue_date", { ascending: false });
  if (error) throw new Error(error.message);
  const invoices = (data ?? []) as unknown as (Invoice & { client: InvoiceRow["client"] })[];
  const paid = await paidByInvoice(supabase, invoices.map((i) => i.id));
  const rows = invoices.map((i) => {
    const paidCents = paid.get(i.id) ?? 0;
    return { ...i, paid_cents: paidCents, effective_status: effectiveStatus(i.status, i.total_cents, paidCents, i.due_date) };
  });
  return status ? rows.filter((r) => r.effective_status === status) : rows;
}

export async function getInvoice(id: string): Promise<InvoiceRow | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("invoices")
    .select("*, client:clients(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const inv = data as unknown as Invoice & { client: InvoiceRow["client"] };
  const paid = await paidByInvoice(supabase, [inv.id]);
  const paidCents = paid.get(inv.id) ?? 0;
  return { ...inv, paid_cents: paidCents, effective_status: effectiveStatus(inv.status, inv.total_cents, paidCents, inv.due_date) };
}

export async function getInvoiceItems(invoiceId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("position");
  return (data ?? []) as { id: string; label: string; description: string | null; qty: number; unit_price_cents: number; vat_bps: number; line_total_cents: number }[];
}

export async function getInvoicePayments(invoiceId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase.from("payments").select("id, paid_at, amount_cents, method, reference, note").eq("invoice_id", invoiceId).order("paid_at", { ascending: false });
  return (data ?? []) as { id: string; paid_at: string; amount_cents: number; method: string | null; reference: string | null; note: string | null }[];
}

export async function getInvoiceReminders(invoiceId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase.from("reminders").select("id, level, sent_at, channel, note").eq("invoice_id", invoiceId).order("sent_at", { ascending: false });
  return (data ?? []) as { id: string; level: number; sent_at: string; channel: string | null; note: string | null }[];
}

/** Tous les paiements (vue globale /commercial/paiements). */
export async function listAllPayments() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("payments")
    .select("id, paid_at, amount_cents, method, invoice:invoices(id, reference, client:clients(name))")
    .order("paid_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown[]).map((p) => {
    const row = p as { id: string; paid_at: string; amount_cents: number; method: string | null; invoice: unknown };
    const inv = Array.isArray(row.invoice) ? row.invoice[0] : row.invoice;
    const client = inv ? (Array.isArray((inv as { client: unknown }).client) ? (inv as { client: unknown[] }).client[0] : (inv as { client: unknown }).client) : null;
    return { id: row.id, paidAt: row.paid_at, amountCents: row.amount_cents, method: row.method, invoice: inv as { id: string; reference: string | null } | null, client: client as { name: string } | null };
  });
}

/** Factures en retard (vue /commercial/relances). */
export async function listOverdueInvoices() {
  const rows = await listInvoices();
  return rows.filter((r) => r.effective_status === "en_retard");
}
