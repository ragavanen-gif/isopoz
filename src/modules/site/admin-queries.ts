import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";
import type { SiteSettings } from "./queries";

export async function getSettingsAdmin(): Promise<SiteSettings & Record<string, unknown>> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("site_settings").select("*").eq("id", true).single();
  return data as SiteSettings & Record<string, unknown>;
}

export async function listAllReviews() {
  const supabase = await createServerClient();
  const { data } = await supabase.from("reviews").select("*").order("position");
  return (data ?? []) as { id: string; author_name: string; author_role: string | null; rating: number; content: string; published: boolean; position: number }[];
}

export async function listAllRealisations() {
  const supabase = await createServerClient();
  const { data } = await supabase.from("realisations").select("*").order("position");
  return (data ?? []) as { id: string; title: string; description: string | null; location: string | null; image_path: string | null; published: boolean; position: number }[];
}

export async function listAllServices() {
  const supabase = await createServerClient();
  const { data } = await supabase.from("simulator_services").select("*").order("position");
  return (data ?? []) as { id: string; name: string; description: string | null; unit_label: string; unit_price_cents: number; active: boolean; position: number }[];
}

export async function listLeads() {
  const supabase = await createServerClient();
  const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as { id: string; source: string; name: string | null; email: string | null; phone: string | null; message: string | null; estimate_cents: number | null; status: string; created_at: string }[];
}
