"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { toCents } from "@/lib/format";

const nn = (v?: string | null) => (v && v !== "" ? v : null);

/** Crée une facture à partir d'un chantier (règle 6 : reliée chantier + devis). */
export async function createInvoiceFromProjectAction(projectId: string) {
  const user = await requirePermission("invoices.create");
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, client_id, quote_id, reference, status")
    .eq("id", projectId).single();
  if (!project) throw new Error("Chantier introuvable.");

  const year = new Date().getFullYear();
  const { data: reference } = await admin.rpc("next_reference", { p_scope: "invoice", p_prefix: "FAC", p_year: year });
  const due = new Date(); due.setDate(due.getDate() + 30);

  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      reference,
      client_id: project.client_id,
      quote_id: project.quote_id,
      project_id: project.id,
      due_date: due.toISOString().slice(0, 10),
      status: "brouillon",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !invoice) throw new Error(error?.message ?? "Échec de création de la facture.");

  // Reprend les lignes du devis lié (zéro ressaisie).
  if (project.quote_id) {
    const { data: qItems } = await admin.from("quote_items").select("*").eq("quote_id", project.quote_id).order("position");
    const items = (qItems ?? []) as { position: number; label: string; description: string | null; qty: number; unit_price_cents: number; discount_bps: number; vat_bps: number }[];
    if (items.length) {
      await admin.from("invoice_items").insert(items.map((it) => ({
        invoice_id: invoice.id,
        position: it.position,
        label: it.label,
        description: it.description,
        qty: it.qty,
        // Applique la remise du devis dans le prix unitaire facturé.
        unit_price_cents: Math.round(it.unit_price_cents * (1 - it.discount_bps / 10000)),
        vat_bps: it.vat_bps,
      })));
    }
    await admin.rpc("recompute_invoice_totals", { p_invoice_id: invoice.id });
  }

  // Le chantier passe à « facturé ».
  if (project.status === "a_facturer" || project.status === "termine") {
    await admin.from("projects").update({ status: "facture" }).eq("id", projectId);
    await admin.from("project_events").insert({ project_id: projectId, user_id: user.id, type: "invoice", message: `Facture ${reference} créée` });
  }

  await writeAudit({ userId: user.id, action: "invoice.create_from_project", entityType: "invoice", entityId: invoice.id, after: { projectId } });
  revalidatePath("/commercial/factures");
  redirect(`/commercial/factures/${invoice.id}`);
}

export async function updateInvoiceMetaAction(id: string, formData: FormData) {
  const user = await requirePermission("invoices.edit");
  const admin = createAdminClient();
  await admin.from("invoices").update({
    issue_date: nn(String(formData.get("issueDate") ?? "")) ?? undefined,
    due_date: nn(String(formData.get("dueDate") ?? "")),
    payment_terms: nn(String(formData.get("paymentTerms") ?? "")),
    notes: nn(String(formData.get("notes") ?? "")),
  }).eq("id", id);
  await writeAudit({ userId: user.id, action: "invoice.update", entityType: "invoice", entityId: id });
  revalidatePath(`/commercial/factures/${id}`);
}

export async function sendInvoiceAction(id: string) {
  const user = await requirePermission("invoices.send");
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices").select("status").eq("id", id).single();
  if (inv?.status === "brouillon") {
    await admin.from("invoices").update({ status: "en_attente" }).eq("id", id);
  }
  await writeAudit({ userId: user.id, action: "invoice.send", entityType: "invoice", entityId: id });
  revalidatePath(`/commercial/factures/${id}`);
}

export async function recordPaymentAction(invoiceId: string, formData: FormData) {
  const user = await requirePermission("payments.create");
  const amount = String(formData.get("amount") ?? "");
  if (!amount) return;
  const admin = createAdminClient();
  await admin.from("payments").insert({
    invoice_id: invoiceId,
    amount_cents: toCents(amount),
    paid_at: nn(String(formData.get("paidAt") ?? "")) ?? new Date().toISOString().slice(0, 10),
    method: nn(String(formData.get("method") ?? "")),
    reference: nn(String(formData.get("reference") ?? "")),
    created_by: user.id,
  });
  // Recalcule le statut (payée / partielle / en attente).
  await admin.rpc("refresh_invoice_status", { p_invoice_id: invoiceId });
  await writeAudit({ userId: user.id, action: "payment.record", entityType: "invoice", entityId: invoiceId, after: { amount } });
  revalidatePath(`/commercial/factures/${invoiceId}`);
  revalidatePath("/commercial/paiements");
}

export async function deletePaymentAction(invoiceId: string, paymentId: string) {
  const user = await requirePermission("payments.delete");
  const admin = createAdminClient();
  await admin.from("payments").delete().eq("id", paymentId);
  await admin.rpc("refresh_invoice_status", { p_invoice_id: invoiceId });
  await writeAudit({ userId: user.id, action: "payment.delete", entityType: "payment", entityId: paymentId });
  revalidatePath(`/commercial/factures/${invoiceId}`);
}

export async function addReminderAction(invoiceId: string, formData: FormData) {
  const user = await requirePermission("reminders.send");
  const admin = createAdminClient();
  const { data: last } = await admin.from("reminders").select("level").eq("invoice_id", invoiceId).order("level", { ascending: false }).limit(1).maybeSingle();
  const level = Math.min((last?.level ?? 0) + 1, 3);
  await admin.from("reminders").insert({
    invoice_id: invoiceId, level, note: nn(String(formData.get("note") ?? "")), created_by: user.id,
  });
  await writeAudit({ userId: user.id, action: "reminder.add", entityType: "invoice", entityId: invoiceId, after: { level } });
  revalidatePath(`/commercial/factures/${invoiceId}`);
  revalidatePath("/commercial/relances");
}

export async function deleteInvoiceAction(id: string) {
  const user = await requirePermission("invoices.delete");
  const admin = createAdminClient();
  await admin.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await writeAudit({ userId: user.id, action: "invoice.delete", entityType: "invoice", entityId: id });
  revalidatePath("/commercial/factures");
  redirect("/commercial/factures");
}
