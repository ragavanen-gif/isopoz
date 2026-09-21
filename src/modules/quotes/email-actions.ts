"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { sendEmail } from "@/core/email/send";
import { brandedEmail } from "@/core/email/templates";
import { renderQuotePdf } from "@/core/documents/pdf/quote-pdf";
import { euros, dateFr } from "@/lib/format";

type Result = { ok: true } | { ok: false; error: string };

/** Envoie le devis au client par email (PDF joint) et passe le statut à « envoyé ». */
export async function sendQuoteByEmailAction(quoteId: string): Promise<Result> {
  const user = await requirePermission("quotes.send");
  const admin = createAdminClient();

  const [{ data: quote }, { data: settings }] = await Promise.all([
    admin.from("quotes").select("*, client:clients(*), manager:users!quotes_created_by_fkey(full_name)").eq("id", quoteId).single(),
    admin.from("company_settings").select("*").eq("id", true).single(),
  ]);
  if (!quote) return { ok: false, error: "Devis introuvable." };
  const client = quote.client as { name: string; email: string | null; address: string | null; postal_code: string | null; city: string | null; siret: string | null; vat_number: string | null };
  if (!client?.email) return { ok: false, error: "Le client n'a pas d'adresse email." };

  const { data: items } = await admin.from("quote_items").select("*").eq("quote_id", quoteId).order("position");
  const manager = quote.manager as { full_name: string | null } | null;

  type It = { kind: string; label: string; description: string | null; qty: number; unit_price_cents: number; discount_bps: number; vat_bps: number; line_total_cents: number };
  const pdf = await renderQuotePdf({
    company: { name: settings?.name ?? "ISOPoz", address: settings?.address ?? null, siret: settings?.siret ?? null, vat: settings?.vat_number ?? null },
    client: { name: client.name, address: client.address, postalCode: client.postal_code, city: client.city, email: client.email, siret: client.siret, vat: client.vat_number },
    quote: {
      reference: quote.reference ?? "DEVIS", issueDate: quote.issue_date, validUntil: quote.valid_until, subject: quote.subject,
      paymentTerms: quote.payment_terms, notes: quote.notes, subtotalCents: quote.subtotal_cents, vatCents: quote.vat_cents, totalCents: quote.total_cents,
    },
    items: ((items ?? []) as It[]).map((it) => ({ kind: it.kind, label: it.label, description: it.description, qty: it.qty, unitPriceCents: it.unit_price_cents, discountBps: it.discount_bps, vatBps: it.vat_bps, lineTotalCents: it.line_total_cents })),
    managerName: manager?.full_name ?? null,
  });

  const html = brandedEmail({
    companyName: settings?.name ?? "ISOPoz",
    title: `Votre devis ${quote.reference ?? ""}`,
    bodyHtml: `
      <p>Bonjour,</p>
      <p>Veuillez trouver ci-joint votre devis <strong>${quote.reference ?? ""}</strong>${quote.subject ? ` — ${escapeHtml(quote.subject)}` : ""}.</p>
      <p><strong>Montant total : ${euros(quote.total_cents)} TTC</strong>${quote.valid_until ? `<br>Valable jusqu'au ${dateFr(quote.valid_until)}.` : ""}</p>
      <p>Nous restons à votre disposition pour toute question.</p>
      ${manager?.full_name ? `<p>Cordialement,<br>${escapeHtml(manager.full_name)}</p>` : ""}
    `,
  });

  const res = await sendEmail({
    to: client.email,
    subject: `Devis ${quote.reference ?? ""} — ${settings?.name ?? "ISOPoz"}`,
    html,
    attachments: [{ filename: `${quote.reference ?? "devis"}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  if (!res.ok) return res;

  if (quote.status === "brouillon") await admin.from("quotes").update({ status: "envoye" }).eq("id", quoteId);
  await writeAudit({ userId: user.id, action: "quote.email_sent", entityType: "quote", entityId: quoteId, after: { to: client.email } });
  revalidatePath(`/commercial/devis/${quoteId}`);
  return { ok: true };
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
