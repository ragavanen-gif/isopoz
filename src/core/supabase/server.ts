import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur (RSC / Server Actions), lié à la session de
 * l'utilisateur via les cookies. Soumis aux RLS — c'est le client par défaut
 * pour les lectures. Pour les mutations privilégiées, voir admin.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un RSC : ignoré (le middleware rafraîchit la session).
          }
        },
      },
    },
  );
}
