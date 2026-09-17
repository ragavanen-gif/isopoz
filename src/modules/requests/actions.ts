"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { requestSchema, REQUEST_TRANSITIONS, type RequestStatus } from "./schema";

type Result = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function parse(formData: FormData) {
  return requestSchema.safeParse({
    clientId: formData.get("clientId"),
    subject: formData.get("subject"),
    description: formData.get("description"),
    receivedAt: formData.get("receivedAt"),
    managerId: formData.get("managerId"),
  });
}

const nn = (v?: string | null) => (v && v !== "" ? v : null);

export async function createRequestAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("requests.create");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Formulaire invalide.", fieldErrors: fe };
  }
  const admin = createAdminClient();
  const year = new Date().getFullYear();
  const { data: reference } = await admin.rpc("next_reference", {
    p_scope: "request", p_prefix: "DEM", p_year: year,
  });
  const { data, error } = await admin
    .from("customer_requests")
    .insert({
      reference,
      client_id: parsed.data.clientId,
      subject: parsed.data.subject.trim(),
      description: nn(parsed.data.description),
      received_at: nn(parsed.data.receivedAt) ?? new Date().toISOString().slice(0, 10),
      manager_id: nn(parsed.data.managerId),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Échec." };
  await writeAudit({ userId: user.id, action: "request.create", entityType: "customer_request", entityId: data.id, after: parsed.data });
  revalidatePath("/demandes");
  redirect(`/demandes/${data.id}`);
}

export async function updateRequestAction(id: string, _prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("requests.edit");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Formulaire invalide.", fieldErrors: fe };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_requests")
    .update({
      client_id: parsed.data.clientId,
      subject: parsed.data.subject.trim(),
      description: nn(parsed.data.description),
      received_at: nn(parsed.data.receivedAt) ?? undefined,
      manager_id: nn(parsed.data.managerId),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({ userId: user.id, action: "request.update", entityType: "customer_request", entityId: id, after: parsed.data });
  revalidatePath(`/demandes/${id}`);
  redirect(`/demandes/${id}`);
}

export async function setRequestStatusAction(id: string, next: RequestStatus) {
  const user = await requirePermission("requests.edit");
  const admin = createAdminClient();
  const { data: current } = await admin.from("customer_requests").select("status").eq("id", id).single();
  const from = current?.status as RequestStatus | undefined;
  if (from && !REQUEST_TRANSITIONS[from].includes(next)) {
    throw new Error(`Transition invalide : ${from} → ${next}`);
  }
  await admin.from("customer_requests").update({ status: next }).eq("id", id);
  await writeAudit({ userId: user.id, action: "request.status", entityType: "customer_request", entityId: id, before: { status: from }, after: { status: next } });
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/demandes");
}

export async function deleteRequestAction(id: string) {
  const user = await requirePermission("requests.delete");
  const admin = createAdminClient();
  await admin.from("customer_requests").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await writeAudit({ userId: user.id, action: "request.delete", entityType: "customer_request", entityId: id });
  revalidatePath("/demandes");
  redirect("/demandes");
}

/**
 * Transforme une demande en devis (règle 8 : zéro ressaisie).
 * Le devis hérite du client, de l'objet ; la demande passe en « devis_a_preparer ».
 */
export async function convertRequestToQuoteAction(requestId: string) {
  const user = await requirePermission("quotes.create");
  const admin = createAdminClient();
  const { data: req } = await admin
    .from("customer_requests")
    .select("id, client_id, subject, status")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Demande introuvable.");

  const year = new Date().getFullYear();
  const { data: reference } = await admin.rpc("next_reference", { p_scope: "quote", p_prefix: "DEV", p_year: year });
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const { data: quote, error } = await admin
    .from("quotes")
    .insert({
      reference,
      client_id: req.client_id,
      request_id: req.id,
      subject: req.subject,
      valid_until: validUntil.toISOString().slice(0, 10),
      status: "brouillon",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !quote) throw new Error(error?.message ?? "Échec de création du devis.");

  // La demande avance dans le workflow.
  if (req.status !== "devis_a_preparer" && req.status !== "devis_envoye") {
    await admin.from("customer_requests").update({ status: "devis_a_preparer" }).eq("id", requestId);
  }
  await writeAudit({ userId: user.id, action: "request.convert_to_quote", entityType: "quote", entityId: quote.id, after: { requestId } });
  revalidatePath(`/demandes/${requestId}`);
  redirect(`/commercial/devis/${quote.id}`);
}
