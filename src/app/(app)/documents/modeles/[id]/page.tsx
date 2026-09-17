import { notFound } from "next/navigation";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getTemplate, getCurrentVersion, docTypeLabel } from "@/modules/documents/templates";
import { deleteTemplateAction } from "@/modules/documents/actions";
import { TemplateEditor } from "@/modules/documents/template-editor";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function TemplateDetailPage({ params }: PageProps<"/documents/modeles/[id]"> ) {
  await requirePermission("templates.view");
  const user = await getSessionUser();
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  const version = await getCurrentVersion(template);

  const canEdit = user ? userCan(user, "templates.edit") : false;
  const canDelete = user ? userCan(user, "templates.delete") : false;

  return (
    <>
      <PageHeader
        title={template.name}
        description={`${docTypeLabel(template.doc_type)} · version ${version?.version ?? 1}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={template.scope === "company" ? "info" : "neutral"}>
              {template.scope === "company" ? "Entreprise" : "Personnel"}
            </Badge>
            {canDelete && (
              <form action={deleteTemplateAction.bind(null, id)}>
                <Button type="submit" variant="secondary" size="sm">Supprimer</Button>
              </form>
            )}
          </div>
        }
      />
      <TemplateEditor templateId={id} initialBody={version?.body ?? ""} editable={canEdit} />
    </>
  );
}
