"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import {
  CLIENT_BUCKET, MAX_FILE_BYTES, ALLOWED_MIME, clientDocPath, sanitizeFilename,
} from "@/core/documents/storage";
import { renderQuotePdf } from "@/core/documents/pdf/quote-pdf";

type Result = { ok: true; id: string } | { ok: false; error: string };

/** Téléverse un fichier arbitraire, classé automatiquement Client → Année → Type. */
export async function uploadDocumentAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("documents.upload");
  const file = formData.get("file");
  const clientId = String(formData.get("clientId") ?? "");
  const docType = String(formData.get("docType") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fichier requis." };
  if (!clientId || !docType) return { ok: false, error: "Client et type requis." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Fichier trop volumineux (max 10 Mo)." };
  if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: `Type de fichier non autorisé (${file.type || "inconnu"}).` };

  const year = new Date().getFullYear();
  const path = clientDocPath(clientId, year, docType, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from(CLIENT_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data, error } = await admin
    .from("documents")
    .insert({
      client_id: clientId,
      year,
      doc_type: docType,
      name: name || sanitizeFilename(file.name),
      storage_path: path,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Échec." };

  await writeAudit({ userId: user.id, action: "document.upload", entityType: "document", entityId: data.id, after: { docType, clientId } });
  revalidatePath("/documents");
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, id: data.id };
}

/**
 * Génère le PDF d'un devis, le range dans client-docs et crée la ligne document.
 * Le corps est produit à partir des données du devis (zéro ressaisie).
 */
export async function generateQuoteDocumentAction(quoteId: string): Promise<Result> {
  const user = await requirePermission("documents.upload");
  const admin = createAdminClient();

  const [{ data: quote }, { data: settings }] = await Promise.all([
    admin.from("quotes")
      .select("*, client:clients(*), manager:users!quotes_created_by_fkey(full_name)")
      .eq("id", quoteId).single(),
    admin.from("company_settings").select("*").eq("id", true).single(),
  ]);
  if (!quote) return { ok: false, error: "Devis introuvable." };

  const { data: items } = await admin
    .from("quote_items").select("*").eq("quote_id", quoteId).order("position");

  type ItemRow = {
    kind: string; label: string; description: string | null; qty: number;
    unit_price_cents: number; discount_bps: number; vat_bps: number; line_total_cents: number;
  };
  const client = quote.client as {
    name: string; address: string | null; postal_code: string | null; city: string | null;
    email: string | null; siret: string | null; vat_number: string | null;
  };
  const manager = quote.manager as { full_name: string | null } | null;

  const pdf = await renderQuotePdf({
    company: {
      name: settings?.name ?? "ISOPoz",
      address: settings?.address ?? null,
      siret: settings?.siret ?? null,
      vat: settings?.vat_number ?? null,
    },
    client: {
      name: client?.name ?? "",
      address: client?.address ?? null,
      postalCode: client?.postal_code ?? null,
      city: client?.city ?? null,
      email: client?.email ?? null,
      siret: client?.siret ?? null,
      vat: client?.vat_number ?? null,
    },
    quote: {
      reference: quote.reference ?? "DEVIS",
      issueDate: quote.issue_date,
      validUntil: quote.valid_until,
      subject: quote.subject,
      paymentTerms: quote.payment_terms,
      notes: quote.notes,
      subtotalCents: quote.subtotal_cents,
      vatCents: quote.vat_cents,
      totalCents: quote.total_cents,
    },
    items: ((items ?? []) as ItemRow[]).map((it) => ({
      kind: it.kind, label: it.label, description: it.description, qty: it.qty,
      unitPriceCents: it.unit_price_cents, discountBps: it.discount_bps,
      vatBps: it.vat_bps, lineTotalCents: it.line_total_cents,
    })),
    managerName: manager?.full_name ?? null,
  });

  const year = new Date(quote.issue_date).getFullYear();
  const filename = `${quote.reference ?? "devis"}.pdf`;
  const path = clientDocPath(quote.client_id, year, "devis", filename);
  const { error: upErr } = await admin.storage.from(CLIENT_BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data, error } = await admin
    .from("documents")
    .insert({
      client_id: quote.client_id,
      year,
      doc_type: "devis",
      reference: quote.reference,
      name: filename,
      storage_path: path,
      amount_cents: quote.total_cents,
      status: quote.status,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Échec." };

  await writeAudit({ userId: user.id, action: "document.generate_quote", entityType: "document", entityId: data.id, after: { quoteId } });
  revalidatePath(`/commercial/devis/${quoteId}`);
  revalidatePath("/documents");
  revalidatePath(`/clients/${quote.client_id}`);
  return { ok: true, id: data.id };
}
