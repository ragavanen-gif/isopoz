import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/core/supabase/server";
import type { PermissionKey } from "@/core/permissions/catalog";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  isSuperAdmin: boolean;
  status: "active" | "disabled";
  employeeId: string | null;
  permissions: Set<string>;
};

/**
 * Charge l'utilisateur courant + ses permissions effectives (via la fonction SQL
 * my_permission_keys). `cache` évite les requêtes redondantes dans un même rendu.
 * Retourne null si non authentifié.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: permRows }] = await Promise.all([
    supabase.from("users").select("full_name, is_super_admin, status, employee_id").eq("id", user.id).single(),
    supabase.rpc("my_permission_keys"),
  ]);

  const permissions = new Set<string>(
    Array.isArray(permRows) ? (permRows as string[]) : [],
  );

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    isSuperAdmin: profile?.is_super_admin ?? false,
    status: (profile?.status as "active" | "disabled") ?? "active",
    employeeId: (profile?.employee_id as string | null) ?? null,
    permissions,
  };
});

/** Exige une session valide (sinon redirige vers /login). */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "disabled") redirect("/login?error=disabled");
  return user;
}

export function userCan(user: SessionUser, key: PermissionKey): boolean {
  return user.isSuperAdmin || user.permissions.has(key);
}

/** Exige une permission ; lève une erreur 403 logique si absente. */
export async function requirePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await requireAuth();
  if (!userCan(user, key)) {
    throw new Error(`FORBIDDEN: permission requise « ${key} »`);
  }
  return user;
}
