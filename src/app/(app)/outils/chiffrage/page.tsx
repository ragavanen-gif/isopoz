import Link from "next/link";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listEstimationProjects } from "@/modules/tools/queries";
import { ProjectCreateForm } from "@/modules/tools/project-create-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dateFr } from "@/lib/format";

export default async function ChiffragePage() {
  await requirePermission("tools.view");
  const user = await getSessionUser();
  const projects = await listEstimationProjects();
  const canManage = user ? userCan(user, "tools.manage") : false;

  return (
    <>
      <PageHeader
        title="Chiffrage — métré calorifuge"
        description="Importez un plan PDF, calibrez l'échelle, mesurez les réseaux et chiffrez."
        actions={<Link href="/outils/chiffrage/prestations"><Button variant="secondary" size="sm">Bibliothèque prestations</Button></Link>}
      />

      {canManage && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Nouveau métré</CardTitle></CardHeader>
          <CardContent><ProjectCreateForm /></CardContent>
        </Card>
      )}

      {projects.length === 0 ? (
        <EmptyState message="Aucun projet de métré. Importez un plan PDF pour commencer." />
      ) : (
        <Table>
          <THead><TR><TH>Projet</TH><TH>Plan</TH><TH>Échelle</TH><TH className="text-right">Mesures</TH><TH>Modifié</TH></TR></THead>
          <TBody>
            {projects.map((p) => (
              <TR key={p.id}>
                <TD><Link href={`/outils/chiffrage/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link></TD>
                <TD className="text-xs text-muted-foreground">{p.plan_filename ?? "—"}</TD>
                <TD>{p.scale_factor ? <Badge tone="success">Calibrée</Badge> : <Badge tone="warning">Non calibrée</Badge>}</TD>
                <TD className="text-right tabular-nums">{Array.isArray(p.measurements) ? p.measurements.length : 0}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">{dateFr(p.updated_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
