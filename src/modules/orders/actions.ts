"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { toCents } from "@/lib/format";
import { PO_TRANSITIONS, PO_EDITABLE_STATUSES, type PoStatus } from "./constants";

const nn = (v?: string | null) => (v && v !== "" ? v : null);

export async function createOrderAction(_prev: unknown, formData: FormData) {
  const user = await requirePermission("orders.create");
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!supplierId) return { ok: false as const, error: "Fournisseur requis." };
  const admin = createAdminClient();
  const year = new Date().getFullYear();
  const { data: reference } = await admin.rpc("next_reference", { p_scope: "order", p_prefix: "CMD", p_year: year });
  const { data, error } = await admin
    .from("purchase_orders")
    .insert({ reference, supplier_id: supplierId, project_id: nn(String(formData.get("projectId") ?? "")), status: "brouillon", created_by: user.id })
    .select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Échec." };
  await writeAudit({ userId: user.id, action: "order.create", entityType: "purchase_order", entityId: data.id });
  revalidatePath("/achats/commandes");
  redirect(`/achats/commandes/${data.id}`);
}

const itemsSchema = z.array(z.object({
  label: z.string().min(1).max(300),
  qty: z.number().min(0),
  unitPriceCents: z.number().int().min(0),
})).max(200);

export async function saveOrderItemsAction(poId: string, itemsJson: string) {
  const user = await requirePermission("orders.edit");
  const admin = createAdminClient();
  const { data: po } = await admin.from("purchase_orders").select("status").eq("id", poId).single();
  if (!po || !PO_EDITABLE_STATUSES.includes(po.status as PoStatus)) {
    return { ok: false as const, error: "Commande non modifiable." };
  }
  let raw: unknown;
  try { raw = JSON.parse(itemsJson); } catch { return { ok: false as const, error: "Données invalides." }; }
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Lignes invalides." };

  await admin.from("purchase_order_items").delete().eq("po_id", poId);
  if (parsed.data.length) {
    await admin.from("purchase_order_items").insert(parsed.data.map((it, i) => ({
      po_id: poId, position: i, label: it.label, qty: it.qty, unit_price_cents: it.unitPriceCents,
    })));
  }
  await admin.rpc("recompute_po_totals", { p_po_id: poId });
  await writeAudit({ userId: user.id, action: "order.save_items", entityType: "purchase_order", entityId: poId });
  revalidatePath(`/achats/commandes/${poId}`);
  return { ok: true as const };
}

export async function updateOrderNotesAction(poId: string, formData: FormData) {
  const user = await requirePermission("orders.edit");
  const admin = createAdminClient();
  await admin.from("purchase_orders").update({ notes: nn(String(formData.get("notes") ?? "")) }).eq("id", poId);
  await writeAudit({ userId: user.id, action: "order.update", entityType: "purchase_order", entityId: poId });
  revalidatePath(`/achats/commandes/${poId}`);
}

export async function setOrderStatusAction(poId: string, next: PoStatus) {
  const user = await requirePermission("orders.edit");
  const admin = createAdminClient();
  const { data: cur } = await admin.from("purchase_orders").select("status").eq("id", poId).single();
  const from = cur?.status as PoStatus | undefined;
  if (from && !PO_TRANSITIONS[from].includes(next)) throw new Error(`Transition invalide : ${from} → ${next}`);
  await admin.from("purchase_orders").update({ status: next }).eq("id", poId);
  await writeAudit({ userId: user.id, action: `order.status.${next}`, entityType: "purchase_order", entityId: poId });
  revalidatePath(`/achats/commandes/${poId}`);
  revalidatePath("/achats/commandes");
}

/** Ajoute une étape de négociation ; met le statut en « négociation ». */
export async function addNegotiationAction(poId: string, formData: FormData) {
  const user = await requirePermission("negotiations.create");
  const amount = String(formData.get("amount") ?? "");
  const party = String(formData.get("party") ?? "isopoz") === "supplier" ? "supplier" : "isopoz";
  if (!amount) return;
  const admin = createAdminClient();
  await admin.from("negotiations").insert({
    po_id: poId, party, amount_cents: toCents(amount),
    at: nn(String(formData.get("at") ?? "")) ?? new Date().toISOString().slice(0, 10),
    note: nn(String(formData.get("note") ?? "")), created_by: user.id,
  });
  // Passe en négociation si envoyée.
  const { data: po } = await admin.from("purchase_orders").select("status").eq("id", poId).single();
  if (po?.status === "envoyee") await admin.from("purchase_orders").update({ status: "negociation" }).eq("id", poId);
  await writeAudit({ userId: user.id, action: "negotiation.add", entityType: "purchase_order", entityId: poId, after: { amount, party } });
  revalidatePath(`/achats/commandes/${poId}`);
}

/** Fixe le prix final négocié (accord). */
export async function setNegotiatedTotalAction(poId: string, formData: FormData) {
  const user = await requirePermission("negotiations.edit");
  const amount = String(formData.get("finalAmount") ?? "");
  const admin = createAdminClient();
  await admin.from("purchase_orders").update({ negotiated_total_cents: amount ? toCents(amount) : null }).eq("id", poId);
  await writeAudit({ userId: user.id, action: "order.negotiated_total", entityType: "purchase_order", entityId: poId, after: { amount } });
  revalidatePath(`/achats/commandes/${poId}`);
}

export async function deleteOrderAction(poId: string) {
  const user = await requirePermission("orders.delete");
  const admin = createAdminClient();
  await admin.from("purchase_orders").update({ deleted_at: new Date().toISOString() }).eq("id", poId);
  await writeAudit({ userId: user.id, action: "order.delete", entityType: "purchase_order", entityId: poId });
  revalidatePath("/achats/commandes");
  redirect("/achats/commandes");
}
