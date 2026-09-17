import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";

export { DOC_TYPES, docTypeLabel } from "./constants";

export type Template = {
  id: string;
  name: string;
  doc_type: string;
  scope: "company" | "personal";
  current_version_id: string | null;
  updated_at: string;
};

export type TemplateVersion = { id: string; version: number; body: string; created_at: string };

export async function listTemplates(): Promise<Template[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("document_templates")
    .select("id, name, doc_type, scope, current_version_id, updated_at")
    .is("deleted_at", null)
    .order("name");
  return (data ?? []) as Template[];
}

export async function getTemplate(id: string): Promise<Template | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("document_templates")
    .select("id, name, doc_type, scope, current_version_id, updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as Template) ?? null;
}

export async function getCurrentVersion(template: Template): Promise<TemplateVersion | null> {
  if (!template.current_version_id) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("document_template_versions")
    .select("id, version, body, created_at")
    .eq("id", template.current_version_id)
    .maybeSingle();
  return (data as TemplateVersion) ?? null;
}
