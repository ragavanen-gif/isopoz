import { NextResponse } from "next/server";
import { createAdminClient } from "@/core/supabase/admin";
import { notifyByPermission } from "@/core/notifications/create";
import { effectiveStatus, type InvoiceStatus } from "@/modules/invoices/constants";

/**
 * Tâche quotidienne (Vercel Cron) :
 *  - expire les devis dont la validité est dépassée
 *  - alerte les gestionnaires des factures en retard
 * Sécurisée par CRON_SECRET (en-tête Authorization: Bearer …).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Expiration des devis (validité dépassée, non conclus)
  const { data: expired } = await admin
    .from("quotes")
    .update({ status: "expire" })
    .lt("valid_until", today)
    .in("status", ["envoye", "en_attente"])
    .is("deleted_at", null)
    .select("id");
  const expiredCount = expired?.length ?? 0;

  // 2. Factures en retard → alerte
  const { data: invData } = await admin
    .from("invoices")
    .select("id, total_cents, due_date, status")
    .is("deleted_at", null);
  const { data: payData } = await admin.from("payments").select("invoice_id, amount_cents");
  const paid = new Map<string, number>();
  for (const p of (payData ?? []) as { invoice_id: string; amount_cents: number }[]) {
    paid.set(p.invoice_id, (paid.get(p.invoice_id) ?? 0) + p.amount_cents);
  }
  let overdueCount = 0;
  let overdueCents = 0;
  for (const i of (invData ?? []) as { id: string; total_cents: number; due_date: string | null; status: InvoiceStatus }[]) {
    if (i.status === "brouillon" || i.status === "annulee") continue;
    const p = paid.get(i.id) ?? 0;
    if (effectiveStatus(i.status, i.total_cents, p, i.due_date) === "en_retard") {
      overdueCount += 1;
      overdueCents += i.total_cents - p;
    }
  }

  if (overdueCount > 0) {
    const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(overdueCents / 100);
    await notifyByPermission("invoices.view", {
      type: "invoices.overdue",
      title: "🔔 Factures en retard",
      body: `${overdueCount} facture(s) en retard · ${fmt} impayés. Voir les relances.`,
    });
  }

  return NextResponse.json({ ok: true, expiredQuotes: expiredCount, overdueInvoices: overdueCount });
}
