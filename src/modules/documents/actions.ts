"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";

export async function createTemplateAction(_prev: unknown, formData: FormData) {
  const user = await requirePermission("templates.create");
  const name = String(formData.get("name") ?? "").trim();
  const docType = String(formData.get("docType") ?? "").trim();
  const scope = String(formData.get("scope") ?? "company") === "personal" ? "personal" : "company";
  if (!name || !docType) return { ok: false as const, error: "Nom et type requis." };

  const admin = createAdminClient();
  const { data: tpl, error } = await admin
    .from("document_templates")
    .insert({ name, doc_type: docType, scope, owner_id: scope === "personal" ? user.id : null, created_by: user.id })
    .select("id")
    .single();
  if (error || !tpl) return { ok: false as const, error: error?.message ?? "Échec." };

  // Version 1 vide.
  const { data: version } = await admin
    .from("document_template_versions")
    .insert({ template_id: tpl.id, version: 1, body: "", created_by: user.id })
    .select("id")
    .single();
  if (version) {
    await admin.from("document_templates").update({ current_version_id: version.id }).eq("id", tpl.id);
  }
  await writeAudit({ userId: user.id, action: "template.create", entityType: "document_template", entityId: tpl.id });
  revalidatePath("/documents/modeles");
  redirect(`/documents/modeles/${tpl.id}`);
}

/** Sauvegarde le corps : crée une NOUVELLE version (les documents passés ne bougent pas — règle 10). */
export async function saveTemplateBodyAction(templateId: string, formData: FormData) {
  const user = await requirePermission("templates.edit");
  const body = String(formData.get("body") ?? "");
  const admin = createAdminClient();

  const { data: last } = await admin
    .from("document_template_versions")
    .select("version")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (last?.version ?? 0) + 1;

  const { data: version, error } = await admin
    .from("document_template_versions")
    .insert({ template_id: templateId, version: nextVersion, body, created_by: user.id })
    .select("id")
    .single();
  if (error || !version) return;

  await admin.from("document_templates").update({ current_version_id: version.id }).eq("id", templateId);
  await writeAudit({ userId: user.id, action: "template.new_version", entityType: "document_template", entityId: templateId, after: { version: nextVersion } });
  revalidatePath(`/documents/modeles/${templateId}`);
}

export async function deleteTemplateAction(templateId: string) {
  const user = await requirePermission("templates.delete");
  const admin = createAdminClient();
  await admin.from("document_templates").update({ deleted_at: new Date().toISOString() }).eq("id", templateId);
  await writeAudit({ userId: user.id, action: "template.delete", entityType: "document_template", entityId: templateId });
  revalidatePath("/documents/modeles");
  redirect("/documents/modeles");
}
