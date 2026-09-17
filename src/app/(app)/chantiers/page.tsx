import Link from "next/link";
import { requirePermission } from "@/core/auth/session";
import { listProjects } from "@/modules/projects/queries";
import { PROJECT_STATUS_LABELS } from "@/modules/projects/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { dateFr, euros } from "@/lib/format";

export default async function ChantiersPage({ searchParams }: PageProps<"/chantiers">) {
  await requirePermission("projects.view");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const projects = await listProjects(status);

  return (
    <>
      <PageHeader
        title="Chantiers"
        description={`${projects.length} chantier(s). Un chantier se crée depuis un devis accepté.`}
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/chantiers" className={!status ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>Tous</Link>
        {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => (
          <Link key={key} href={`/chantiers?status=${key}`} className={status === key ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>{label}</Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <EmptyState message="Aucun chantier. Validez un devis puis créez le chantier depuis sa fiche." />
      ) : (
        <Table>
          <THead><TR><TH>Référence</TH><TH>Client</TH><TH>Devis</TH><TH>Début</TH><TH className="text-right">Montant devis</TH><TH>Statut</TH></TR></THead>
          <TBody>
            {projects.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link href={`/chantiers/${p.id}`} className="font-mono text-xs text-primary hover:underline">{p.reference}</Link>
                </TD>
                <TD>{p.client?.name ?? "—"}</TD>
                <TD className="font-mono text-xs text-muted-foreground">{p.quote?.reference ?? "—"}</TD>
                <TD className="whitespace-nowrap">{dateFr(p.start_date)}</TD>
                <TD className="text-right tabular-nums">{euros(p.quote_total_cents)}</TD>
                <TD><StatusBadge status={p.status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
