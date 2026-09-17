"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";

const nn = (v?: string | null) => (v && v !== "" ? v : null);

export async function createTeamAction(_prev: unknown, formData: FormData) {
  const user = await requirePermission("teams.create");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false as const, error: "Nom requis." };
  const admin = createAdminClient();
  const { data, error } = await admin.from("teams").insert({ name }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Échec." };
  await writeAudit({ userId: user.id, action: "team.create", entityType: "team", entityId: data.id });
  revalidatePath("/personnel/equipes");
  redirect(`/personnel/equipes/${data.id}`);
}

export async function updateTeamAction(id: string, formData: FormData) {
  const user = await requirePermission("teams.edit");
  const name = String(formData.get("name") ?? "").trim();
  const leadId = nn(String(formData.get("teamLeadId") ?? ""));
  const admin = createAdminClient();
  await admin.from("teams").update({ name, team_lead_id: leadId }).eq("id", id);
  await writeAudit({ userId: user.id, action: "team.update", entityType: "team", entityId: id });
  revalidatePath(`/personnel/equipes/${id}`);
}

export async function setTeamMembersAction(id: string, formData: FormData) {
  const user = await requirePermission("teams.edit");
  const memberIds = formData.getAll("memberIds").map(String);
  const admin = createAdminClient();
  await admin.from("team_members").delete().eq("team_id", id);
  if (memberIds.length) {
    await admin.from("team_members").insert(memberIds.map((employee_id) => ({ team_id: id, employee_id })));
  }
  await writeAudit({ userId: user.id, action: "team.members", entityType: "team", entityId: id, after: { count: memberIds.length } });
  revalidatePath(`/personnel/equipes/${id}`);
}

export async function deleteTeamAction(id: string) {
  const user = await requirePermission("teams.delete");
  const admin = createAdminClient();
  await admin.from("teams").delete().eq("id", id);
  await writeAudit({ userId: user.id, action: "team.delete", entityType: "team", entityId: id });
  revalidatePath("/personnel/equipes");
  redirect("/personnel/equipes");
}
