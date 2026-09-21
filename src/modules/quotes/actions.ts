"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { notifyByPermission } from "@/core/notifications/create";
import {
  quoteMetaSchema, quoteItemsSchema, QUOTE_TRANSITIONS, QUOTE_EDITABLE_STATUSES,
  type QuoteStatus,
} from "./schema";

const nn = (v?: string | null) => (v && v !== "" ? v : null);

/** Création d'un devis autonome (hors demande). */
export async function createQuoteAction(_prev: unknown, formData: FormData) {
  const user = await requirePermission("quotes.create");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { ok: false as const, error: "Client requis." };

  const admin = createAdminClient();
  const year = new Date().getFullYear();
  const { data: reference } = await admin.rpc("next_reference", { p_scope: "quote", p_prefix: "DEV", p_year: year });
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const { data, error } = await admin
    .from("quotes")
    .insert({
      reference,
      client_id: clientId,
      subject: nn(String(formData.get("subject") ?? "")),
      valid_until: validUntil.toISOString().slice(0, 10),
      status: "brouillon",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Échec." };
  await writeAudit({ userId: user.id, action: "quote.create", entityType: "quote", entityId: data.id });
  revalidatePath("/commercial/devis");
  redirect(`/commercial/devis/${data.id}`);
}

export async function updateQuoteMetaAction(quoteId: string, formData: FormData) {
  const user = await requirePermission("quotes.edit");
  const parsed = quoteMetaSchema.safeParse({
    subject: formData.get("subject"),
    issueDate: formData.get("issueDate"),
    validUntil: formData.get("validUntil"),
    paymentTerms: formData.get("paymentTerms"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return;
  const admin = createAdminClient();
  await admin
    .from("quotes")
    .update({
      subject: nn(parsed.data.subject),
      issue_date: nn(parsed.data.issueDate) ?? undefined,
      valid_until: nn(parsed.data.validUntil),
      payment_terms: nn(parsed.data.paymentTerms),
      notes: nn(parsed.data.notes),
    })
    .eq("id", quoteId);
  await writeAudit({ userId: user.id, action: "quote.update_meta", entityType: "quote", entityId: quoteId });
  revalidatePath(`/commercial/devis/${quoteId}`);
}

/** Enregistre l'ensemble des lignes puis recalcule les totaux côté serveur. */
export async function saveQuoteItemsAction(quoteId: string, itemsJson: string) {
  const user = await requirePermission("quotes.edit");
  const admin = createAdminClient();

  const { data: quote } = await admin.from("quotes").select("status").eq("id", quoteId).single();
  const status = quote?.status as QuoteStatus | undefined;
  if (!status || !QUOTE_EDITABLE_STATUSES.includes(status)) {
    return { ok: false as const, error: "Ce devis n'est plus modifiable." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(itemsJson);
  } catch {
    return { ok: false as const, error: "Données invalides." };
  }
  const parsed = quoteItemsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Lignes invalides." };

  await admin.from("quote_items").delete().eq("quote_id", quoteId);
  if (parsed.data.length > 0) {
    await admin.from("quote_items").insert(
      parsed.data.map((it, i) => ({
        quote_id: quoteId,
        position: i,
        kind: it.kind,
        label: it.label,
        description: it.description || null,
        qty: it.qty,
        unit_price_cents: it.unitPriceCents,
        discount_bps: it.discountBps,
        vat_bps: it.vatBps,
      })),
    );
  }
  // Source de vérité des totaux : fonction SQL.
  await admin.rpc("recompute_quote_totals", { p_quote_id: quoteId });
  await writeAudit({ userId: user.id, action: "quote.save_items", entityType: "quote", entityId: quoteId, after: { count: parsed.data.length } });
  revalidatePath(`/commercial/devis/${quoteId}`);
  return { ok: true as const };
}

export async function setQuoteStatusAction(quoteId: string, next: QuoteStatus) {
  // Permissions spécifiques : envoi/validation.
  if (next === "envoye") await requirePermission("quotes.send");
  else if (next === "accepte") await requirePermission("quotes.validate");
  const user = await requirePermission("quotes.edit");

  const admin = createAdminClient();
  const { data: current } = await admin.from("quotes").select("status, request_id").eq("id", quoteId).single();
  const from = current?.status as QuoteStatus | undefined;
  if (from && !QUOTE_TRANSITIONS[from].includes(next)) {
    throw new Error(`Transition invalide : ${from} → ${next}`);
  }
  await admin.from("quotes").update({ status: next }).eq("id", quoteId);

  // Synchronise le statut de la demande liée (règle : cohérence du workflow).
  if (current?.request_id) {
    if (next === "envoye") await admin.from("customer_requests").update({ status: "devis_envoye" }).eq("id", current.request_id);
    if (next === "accepte") await admin.from("customer_requests").update({ status: "devis_accepte" }).eq("id", current.request_id);
  }

  await writeAudit({ userId: user.id, action: `quote.status.${next}`, entityType: "quote", entityId: quoteId, before: { status: from }, after: { status: next } });
  if (next === "accepte") {
    const { data: q } = await admin.from("quotes").select("reference").eq("id", quoteId).single();
    await notifyByPermission("projects.create", {
      type: "quote.accepted",
      title: "🔔 Devis accepté",
      body: `${q?.reference ?? "Devis"} accepté — un chantier peut être créé.`,
      entityType: "quote",
      entityId: quoteId,
    });
  }
  revalidatePath(`/commercial/devis/${quoteId}`);
  revalidatePath("/commercial/devis");
}

export async function deleteQuoteAction(quoteId: string) {
  const user = await requirePermission("quotes.delete");
  const admin = createAdminClient();
  await admin.from("quotes").update({ deleted_at: new Date().toISOString() }).eq("id", quoteId);
  await writeAudit({ userId: user.id, action: "quote.delete", entityType: "quote", entityId: quoteId });
  revalidatePath("/commercial/devis");
  redirect("/commercial/devis");
}
