import "server-only";
import { createAdminClient } from "@/core/supabase/admin";

type NotifPayload = {
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
};

/** Crée une notification pour une liste d'utilisateurs. */
export async function notifyUsers(userIds: string[], payload: NotifPayload): Promise<void> {
  if (!userIds.length) return;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert(
      userIds.map((user_id) => ({
        user_id,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        entity_type: payload.entityType ?? null,
        entity_id: payload.entityId ?? null,
      })),
    );
  } catch (err) {
    console.error("[notifications] échec:", err);
  }
}

/**
 * Notifie tous les utilisateurs disposant d'une permission (respecte les
 * permissions — CDC §33). `exceptUserId` évite de se notifier soi-même.
 */
export async function notifyByPermission(
  permissionKey: string,
  payload: NotifPayload,
  exceptUserId?: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("users_with_permission", { perm: permissionKey });
    const ids = (Array.isArray(data) ? (data as string[]) : []).filter((id) => id !== exceptUserId);
    await notifyUsers(ids, payload);
  } catch (err) {
    console.error("[notifications] échec ciblage permission:", err);
  }
}
