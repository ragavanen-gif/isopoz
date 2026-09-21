"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { sendEmail } from "@/core/email/send";
import { brandedEmail } from "@/core/email/templates";
import { renderInvoicePdf } from "@/core/documents/pdf/invoice-pdf";
import { euros, dateFr } from "@/lib/format";

type Result = { ok: true } | { ok: false; error: string };

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function loadInvoice(admin: ReturnType<typeof createAdminClient>, invoiceId: string) {
  const [{ data: invoice }, { data: settings }] = await Promise.all([
    admin.from("invoices").select("*, client:clients(*)").eq("id", invoiceId).single(),
    admin.from("company_settings").select("*").eq("id", true).single(),
  ]);
  return { invoice, settings };
}

/** Envoie la facture au client par email (PDF joint). */
export async function sendInvoiceByEmailAction(invoiceId: string): Promise<Result> {
  const user = await requirePermission("invoices.send");
  const admin = createAdminClient();
  const { invoice, settings } = await loadInvoice(admin, invoiceId);
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  const client = invoice.client as { name: string; email: string | null; address: string | null; postal_code: string | null; city: string | null; siret: string | null };
  if (!client?.email) return { ok: false, error: "Le client n'a pas d'adresse email." };

  const { data: items } = await admin.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("position");
  type It = { label: string; qty: number; unit_price_cents: number; vat_bps: number; line_total_cents: number };

  const pdf = await renderInvoicePdf({
    company: { name: settings?.name ?? "ISOPoz", address: settings?.address ?? null, siret: settings?.siret ?? null, vat: settings?.vat_number ?? null },
    client: { name: client.name, address: client.address, postalCode: client.postal_code, city: client.city, email: client.email, siret: client.siret },
    invoice: {
      reference: invoice.reference ?? "FACTURE", issueDate: invoice.issue_date, dueDate: invoice.due_date,
      paymentTerms: invoice.payment_terms, notes: invoice.notes, subtotalCents: invoice.subtotal_cents, vatCents: invoice.vat_cents, totalCents: invoice.total_cents,
    },
    items: ((items ?? []) as It[]).map((it) => ({ label: it.label, qty: it.qty, unitPriceCents: it.unit_price_cents, vatBps: it.vat_bps, lineTotalCents: it.line_total_cents })),
  });

  const html = brandedEmail({
    companyName: settings?.name ?? "ISOPoz",
    title: `Votre facture ${invoice.reference ?? ""}`,
    bodyHtml: `
      <p>Bonjour,</p>
      <p>Veuillez trouver ci-joint votre facture <strong>${invoice.reference ?? ""}</strong>.</p>
      <p><strong>Montant total : ${euros(invoice.total_cents)} TTC</strong>${invoice.due_date ? `<br>Échéance de paiement : ${dateFr(invoice.due_date)}.` : ""}</p>
      <p>Nous vous remercions de votre confiance.</p>
    `,
  });

  const res = await sendEmail({
    to: client.email,
    subject: `Facture ${invoice.reference ?? ""} — ${settings?.name ?? "ISOPoz"}`,
    html,
    attachments: [{ filename: `${invoice.reference ?? "facture"}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  if (!res.ok) return res;

  if (invoice.status === "brouillon") await admin.from("invoices").update({ status: "en_attente" }).eq("id", invoiceId);
  await writeAudit({ userId: user.id, action: "invoice.email_sent", entityType: "invoice", entityId: invoiceId, after: { to: client.email } });
  revalidatePath(`/commercial/factures/${invoiceId}`);
  return { ok: true };
}

/** Envoie une relance par email et enregistre la relance. */
export async function sendReminderByEmailAction(invoiceId: string, note?: string): Promise<Result> {
  const user = await requirePermission("reminders.send");
  const admin = createAdminClient();
  const { invoice, settings } = await loadInvoice(admin, invoiceId);
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  const client = invoice.client as { name: string; email: string | null };
  if (!client?.email) return { ok: false, error: "Le client n'a pas d'adresse email." };

  const { data: payData } = await admin.from("payments").select("amount_cents").eq("invoice_id", invoiceId);
  const paid = ((payData ?? []) as { amount_cents: number }[]).reduce((s, p) => s + p.amount_cents, 0);
  const remaining = invoice.total_cents - paid;

  const { data: last } = await admin.from("reminders").select("level").eq("invoice_id", invoiceId).order("level", { ascending: false }).limit(1).maybeSingle();
  const level = Math.min((last?.level ?? 0) + 1, 3);

  const html = brandedEmail({
    companyName: settings?.name ?? "ISOPoz",
    title: `Relance — facture ${invoice.reference ?? ""}`,
    bodyHtml: `
      <p>Bonjour,</p>
      <p>Sauf erreur de notre part, la facture <strong>${invoice.reference ?? ""}</strong>${invoice.due_date ? ` (échéance du ${dateFr(invoice.due_date)})` : ""} reste impayée.</p>
      <p><strong>Montant restant dû : ${euros(remaining)}</strong></p>
      ${note ? `<p>${escapeHtml(note)}</p>` : ""}
      <p>Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.</p>
    `,
  });

  const res = await sendEmail({
    to: client.email,
    subject: `Relance ${level} — facture ${invoice.reference ?? ""}`,
    html,
  });
  if (!res.ok) return res;

  await admin.from("reminders").insert({ invoice_id: invoiceId, level, note: note ?? null, channel: "email", created_by: user.id });
  await writeAudit({ userId: user.id, action: "reminder.email_sent", entityType: "invoice", entityId: invoiceId, after: { level } });
  revalidatePath(`/commercial/factures/${invoiceId}`);
  revalidatePath("/commercial/relances");
  return { ok: true };
}
