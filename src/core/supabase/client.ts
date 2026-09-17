"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase pour le navigateur (soumis aux RLS via la session utilisateur). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
