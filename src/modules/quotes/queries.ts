import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import type { Quote, QuoteItem } from "./schema";

export type QuoteRow = Quote & { client: { id: string; name: string } | null };

export async function listQuotes(status?: string): Promise<QuoteRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("quotes")
    .select("*, client:clients(id, name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as QuoteRow[];
}

export async function getQuote(id: string): Promise<QuoteRow | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("quotes")
    .select("*, client:clients(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as unknown as QuoteRow) ?? null;
}

export async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", quoteId)
    .order("position");
  return (data ?? []) as QuoteItem[];
}
