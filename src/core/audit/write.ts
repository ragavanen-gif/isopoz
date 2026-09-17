import "server-only";
import { createAdminClient } from "@/core/supabase/admin";

/** Écrit une entrée dans le journal d'activité (règle 11). Ne bloque jamais l'action métier. */
export async function writeAudit(params: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      before: params.before ?? null,
      after: params.after ?? null,
    });
  } catch (err) {
    console.error("[audit] échec écriture:", err);
  }
}
