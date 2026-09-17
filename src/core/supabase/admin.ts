import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Client Supabase à privilèges service_role : CONTOURNE les RLS.
 * À n'utiliser QUE dans des Server Actions / route handlers, APRÈS un contrôle
 * de permission explicite (requirePermission). Jamais exposé au navigateur.
 */
export function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
