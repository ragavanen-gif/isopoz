import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import type { PoStatus } from "./constants";

export type PurchaseOrder = {
  id: string;
  reference: string | null;
  supplier_id: string;
  project_id: string | null;
  status: PoStatus;
  initial_total_cents: number;
  negotiated_total_cents: number | null;
  notes: string | null;
  created_at: string;
};

export type OrderRow = PurchaseOrder & { supplier: { id: string; name: string } | null };

export async function listOrders(status?: string): Promise<OrderRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("purchase_orders")
    .select("*, supplier:suppliers(id, name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrderRow[];
}

export async function listSupplierOrders(supplierId: string): Promise<PurchaseOrder[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("supplier_id", supplierId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as PurchaseOrder[];
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("*, supplier:suppliers(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as unknown as OrderRow) ?? null;
}

export async function getOrderItems(poId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("purchase_order_items")
    .select("id, position, label, qty, unit_price_cents, line_total_cents")
    .eq("po_id", poId)
    .order("position");
  return (data ?? []) as { id: string; position: number; label: string; qty: number; unit_price_cents: number; line_total_cents: number }[];
}

export async function getNegotiations(poId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("negotiations")
    .select("id, at, party, amount_cents, note")
    .eq("po_id", poId)
    .order("at", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as { id: string; at: string; party: "supplier" | "isopoz"; amount_cents: number; note: string | null }[];
}
