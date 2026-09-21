"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";

const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  fullName: z.string().min(1, "Nom requis"),
  password: z.string().min(8, "8 caractères minimum"),
});

type Result = { ok: true } | { ok: false; error: string };

export async function createUserAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const admin_ = await requirePermission("admin.users");
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const admin = createAdminClient();
  // Crée le compte auth (le trigger crée la ligne public.users).
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Échec de création." };

  // Le trigger insère la ligne, on s'assure du full_name.
  await admin.from("users").update({ full_name: parsed.data.fullName }).eq("id", data.user.id);

  await writeAudit({
    userId: admin_.id,
    action: "user.create",
    entityType: "user",
    entityId: data.user.id,
    after: { email: parsed.data.email, fullName: parsed.data.fullName },
  });
  revalidatePath("/administration/utilisateurs");
  return { ok: true };
}

export async function setUserStatusAction(userId: string, status: "active" | "disabled") {
  const actor = await requirePermission("admin.users");
  const admin = createAdminClient();
  await admin.from("users").update({ status }).eq("id", userId);
  await writeAudit({
    userId: actor.id,
    action: "user.status",
    entityType: "user",
    entityId: userId,
    after: { status },
  });
  revalidatePath("/administration/utilisateurs");
  revalidatePath(`/administration/utilisateurs/${userId}`);
}

export async function setUserRolesAction(userId: string, formData: FormData) {
  const actor = await requirePermission("admin.users");
  const roleIds = formData.getAll("roleIds").map(String);
  const admin = createAdminClient();
  await admin.from("user_roles").delete().eq("user_id", userId);
  if (roleIds.length > 0) {
    await admin.from("user_roles").insert(roleIds.map((role_id) => ({ user_id: userId, role_id })));
  }
  await writeAudit({
    userId: actor.id,
    action: "user.roles",
    entityType: "user",
    entityId: userId,
    after: { roleIds },
  });
  revalidatePath(`/administration/utilisateurs/${userId}`);
  revalidatePath("/administration/utilisateurs");
}

export async function setUserEmployeeAction(userId: string, formData: FormData) {
  const actor = await requirePermission("admin.users");
  const employeeId = String(formData.get("employeeId") ?? "");
  const admin = createAdminClient();
  await admin.from("users").update({ employee_id: employeeId || null }).eq("id", userId);
  await writeAudit({ userId: actor.id, action: "user.link_employee", entityType: "user", entityId: userId, after: { employeeId: employeeId || null } });
  revalidatePath(`/administration/utilisateurs/${userId}`);
}

export async function setRolePermissionsAction(roleId: string, formData: FormData) {
  const actor = await requirePermission("admin.roles");
  const permIds = formData.getAll("permIds").map(String);
  const admin = createAdminClient();
  await admin.from("role_permissions").delete().eq("role_id", roleId);
  if (permIds.length > 0) {
    await admin
      .from("role_permissions")
      .insert(permIds.map((permission_id) => ({ role_id: roleId, permission_id })));
  }
  await writeAudit({
    userId: actor.id,
    action: "role.permissions",
    entityType: "role",
    entityId: roleId,
    after: { count: permIds.length },
  });
  revalidatePath("/administration/roles");
}
