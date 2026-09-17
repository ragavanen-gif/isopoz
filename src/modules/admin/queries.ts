import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  status: "active" | "disabled";
  is_super_admin: boolean;
  roles: { id: string; name: string }[];
};

export async function listUsers(): Promise<AdminUser[]> {
  const supabase = await createServerClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name, status, is_super_admin")
    .order("created_at", { ascending: true });

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, roles(id, name)");

  const roleMap = new Map<string, { id: string; name: string }[]>();
  for (const ur of (userRoles ?? []) as unknown[]) {
    const row = ur as { user_id: string; roles: { id: string; name: string } | { id: string; name: string }[] | null };
    if (!row.roles) continue;
    const roles = Array.isArray(row.roles) ? row.roles : [row.roles];
    const arr = roleMap.get(row.user_id) ?? [];
    arr.push(...roles);
    roleMap.set(row.user_id, arr);
  }

  return ((users ?? []) as Omit<AdminUser, "roles">[]).map((u) => ({
    ...u,
    roles: roleMap.get(u.id) ?? [],
  }));
}

export type Role = { id: string; name: string; description: string | null; is_system: boolean };

export async function listRoles(): Promise<Role[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name, description, is_system")
    .order("name");
  return (data ?? []) as Role[];
}

export type Permission = { id: string; key: string; module: string; label: string };

export async function listPermissions(): Promise<Permission[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("permissions").select("id, key, module, label").order("key");
  return (data ?? []) as Permission[];
}

export async function getRolePermissionIds(roleId: string): Promise<Set<string>> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);
  return new Set((data ?? []).map((r) => r.permission_id as string));
}

export async function getUserRoleIds(userId: string): Promise<Set<string>> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("user_roles").select("role_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.role_id as string));
}

export type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  at: string;
  user: { full_name: string | null; email: string } | null;
};

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, at, users(full_name, email)")
    .order("at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as {
      id: string; action: string; entity_type: string; entity_id: string | null; at: string;
      users: { full_name: string | null; email: string } | null;
    };
    return { id: r.id, action: r.action, entity_type: r.entity_type, entity_id: r.entity_id, at: r.at, user: r.users };
  });
}
