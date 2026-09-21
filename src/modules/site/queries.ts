import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";

export type SiteSettings = {
  company_name: string; tagline: string; hero_title: string; hero_subtitle: string;
  about_title: string; about_text: string; phone: string | null; email: string | null;
  address: string | null; cta_text: string; simulator_enabled: boolean; simulator_title: string;
};
export type Review = { id: string; author_name: string; author_role: string | null; rating: number; content: string };
export type Realisation = { id: string; title: string; description: string | null; location: string | null; image_path: string | null };
export type SimService = { id: string; name: string; description: string | null; unit_label: string; unit_price_cents: number };

/** URL publique d'un fichier du bucket site-media. */
export function siteMediaUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/site-media/${path}`;
}

const DEFAULT_SETTINGS: SiteSettings = {
  company_name: "ISOPoz", tagline: "Votre spécialiste de l'isolation et de la pose",
  hero_title: "Isolation & rénovation, faites confiance à des experts",
  hero_subtitle: "Devis gratuit, intervention rapide, travaux garantis.",
  about_title: "À propos d'ISOPoz",
  about_text: "Entreprise spécialisée dans l'isolation thermique et la pose.",
  phone: "", email: "contact@isopoz.fr", address: "", cta_text: "Demandez votre devis gratuit",
  simulator_enabled: true, simulator_title: "Estimez votre projet en 1 minute",
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
  return (data as SiteSettings) ?? DEFAULT_SETTINGS;
}

export async function listPublishedReviews(): Promise<Review[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("reviews").select("id, author_name, author_role, rating, content")
    .eq("published", true).order("position");
  return (data ?? []) as Review[];
}

export async function listPublishedRealisations(): Promise<Realisation[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("realisations").select("id, title, description, location, image_path")
    .eq("published", true).order("position");
  return (data ?? []) as Realisation[];
}

export async function listActiveServices(): Promise<SimService[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("simulator_services").select("id, name, description, unit_label, unit_price_cents")
    .eq("active", true).order("position");
  return (data ?? []) as SimService[];
}
