import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import { effectiveStatus, type InvoiceStatus } from "@/modules/invoices/constants";

const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

/**
 * Tableau de bord analytique. On distingue strictement CA FACTURÉ (chiffre
 * d'affaires) et CA ENCAISSÉ (trésorerie) — cf. docs/00 principe 4.
 */
export async function getAnalytics(year: number) {
  const supabase = await createServerClient();
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;

  const [{ data: invData }, { data: payData }, { data: projData }, { data: costData }] = await Promise.all([
    supabase.from("invoices").select("id, total_cents, issue_date, due_date, status, client_id, client:clients(name)").is("deleted_at", null),
    supabase.from("payments").select("amount_cents, paid_at, invoice_id"),
    supabase.from("projects").select("id, reference, quote_total_cents, client:clients(name)").is("deleted_at", null),
    supabase.from("project_costs").select("project_id, amount_cents"),
  ]);

  type Inv = { id: string; total_cents: number; issue_date: string; due_date: string | null; status: InvoiceStatus; client_id: string; client: { name: string } | { name: string }[] | null };
  const invoices = (invData ?? []) as unknown as Inv[];
  const payments = (payData ?? []) as { amount_cents: number; paid_at: string; invoice_id: string }[];

  // Paiements par facture (pour statut effectif).
  const paidByInvoice = new Map<string, number>();
  for (const p of payments) paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + p.amount_cents);

  const billable = invoices.filter((i) => i.status !== "brouillon" && i.status !== "annulee");

  // KPIs année
  const invYear = billable.filter((i) => i.issue_date >= yStart && i.issue_date <= yEnd);
  const caBilled = invYear.reduce((s, i) => s + i.total_cents, 0);
  const caCollected = payments.filter((p) => p.paid_at >= yStart && p.paid_at <= yEnd).reduce((s, p) => s + p.amount_cents, 0);

  let overdue = 0;
  for (const i of billable) {
    const paid = paidByInvoice.get(i.id) ?? 0;
    if (effectiveStatus(i.status, i.total_cents, paid, i.due_date) === "en_retard") overdue += i.total_cents - paid;
  }
  const outstanding = billable.reduce((s, i) => s + (i.total_cents - (paidByInvoice.get(i.id) ?? 0)), 0);

  // CA facturé par mois
  const byMonth = new Array(12).fill(0) as number[];
  for (const i of invYear) {
    const m = new Date(i.issue_date).getMonth();
    byMonth[m] += i.total_cents;
  }
  const monthly = byMonth.map((cents, idx) => ({ label: MONTHS[idx], cents }));

  // CA facturé par client (année)
  const clientMap = new Map<string, number>();
  for (const i of invYear) {
    const name = (Array.isArray(i.client) ? i.client[0]?.name : i.client?.name) ?? "—";
    clientMap.set(name, (clientMap.get(name) ?? 0) + i.total_cents);
  }
  const byClient = Array.from(clientMap.entries())
    .map(([name, cents]) => ({ name, cents }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 10);

  // Rentabilité chantiers
  const costByProject = new Map<string, number>();
  for (const c of (costData ?? []) as { project_id: string; amount_cents: number }[]) {
    costByProject.set(c.project_id, (costByProject.get(c.project_id) ?? 0) + c.amount_cents);
  }
  type Proj = { id: string; reference: string | null; quote_total_cents: number; client: { name: string } | { name: string }[] | null };
  const profitability = ((projData ?? []) as unknown as Proj[])
    .map((p) => {
      const cost = costByProject.get(p.id) ?? 0;
      const margin = p.quote_total_cents - cost;
      const rate = p.quote_total_cents > 0 ? Math.round((margin / p.quote_total_cents) * 100) : 0;
      const clientName = (Array.isArray(p.client) ? p.client[0]?.name : p.client?.name) ?? "—";
      return { id: p.id, reference: p.reference, clientName, quote: p.quote_total_cents, cost, margin, rate };
    })
    .filter((p) => p.quote > 0)
    .sort((a, b) => b.margin - a.margin);

  return {
    year,
    caBilled, caCollected, outstanding, overdue,
    monthly, monthlyMax: Math.max(1, ...byMonth),
    byClient,
    profitability,
  };
}
