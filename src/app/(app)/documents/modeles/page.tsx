import Link from "next/link";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listTemplates, docTypeLabel } from "@/modules/documents/templates";
import { TemplateCreateForm } from "@/modules/documents/template-create-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dateFr } from "@/lib/format";

export default async function TemplatesPage() {
  await requirePermission("templates.view");
  const user = await getSessionUser();
  const templates = await listTemplates();
  const canCreate = user ? userCan(user, "templates.create") : false;

  return (
    <>
      <PageHeader title="Modèles de documents" description="Modèles réutilisables avec variables dynamiques." />

      {canCreate && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Nouveau modèle</CardTitle></CardHeader>
          <CardContent><TemplateCreateForm /></CardContent>
        </Card>
      )}

      {templates.length === 0 ? (
        <EmptyState message="Aucun modèle." />
      ) : (
        <Table>
          <THead><TR><TH>Nom</TH><TH>Type</TH><TH>Portée</TH><TH>Mis à jour</TH></TR></THead>
          <TBody>
            {templates.map((t) => (
              <TR key={t.id}>
                <TD>
                  <Link href={`/documents/modeles/${t.id}`} className="font-medium text-primary hover:underline">{t.name}</Link>
                </TD>
                <TD>{docTypeLabel(t.doc_type)}</TD>
                <TD><Badge tone={t.scope === "company" ? "info" : "neutral"}>{t.scope === "company" ? "Entreprise" : "Personnel"}</Badge></TD>
                <TD className="whitespace-nowrap text-muted-foreground">{dateFr(t.updated_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
