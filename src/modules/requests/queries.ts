import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import type { CustomerRequest } from "./schema";

export type RequestRow = CustomerRequest & {
  client: { id: string; name: string } | null;
  manager: { id: string; full_name: string | null } | null;
};

export async function listRequests(status?: string): Promise<RequestRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("customer_requests")
    .select("*, client:clients(id, name), manager:users!customer_requests_manager_id_fkey(id, full_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RequestRow[];
}

export async function getRequest(id: string): Promise<RequestRow | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("customer_requests")
    .select("*, client:clients(id, name), manager:users!customer_requests_manager_id_fkey(id, full_name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as unknown as RequestRow) ?? null;
}

/** Devis rattachés à une demande. */
export async function getRequestQuotes(requestId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("quotes")
    .select("id, reference, status, total_cents, issue_date")
    .eq("request_id", requestId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Options pour les sélecteurs (clients, gestionnaires). */
export async function getFormOptions() {
  const supabase = await createServerClient();
  const [{ data: clients }, { data: managers }] = await Promise.all([
    supabase.from("clients").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("users").select("id, full_name, email").eq("status", "active").order("full_name"),
  ]);
  return {
    clients: (clients ?? []) as { id: string; name: string }[],
    managers: (managers ?? []) as { id: string; full_name: string | null; email: string }[],
  };
}
