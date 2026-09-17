import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listQuotes } from "@/modules/quotes/queries";
import { QUOTE_STATUS_LABELS } from "@/modules/quotes/schema";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { dateFr, euros } from "@/lib/format";

export default async function DevisPage({ searchParams }: PageProps<"/commercial/devis">) {
  await requirePermission("quotes.view");
  const user = await getSessionUser();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const quotes = await listQuotes(status);
  const canCreate = user ? userCan(user, "quotes.create") : false;

  return (
    <>
      <PageHeader
        title="Devis"
        description={`${quotes.length} devis`}
        actions={
          canCreate && (
            <Link href="/commercial/devis/nouveau">
              <Button><Plus /> Nouveau devis</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/commercial/devis" className={!status ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>Tous</Link>
        {Object.entries(QUOTE_STATUS_LABELS).map(([key, label]) => (
          <Link key={key} href={`/commercial/devis?status=${key}`} className={status === key ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>{label}</Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <EmptyState message="Aucun devis." />
      ) : (
        <Table>
          <THead>
            <TR><TH>Référence</TH><TH>Client</TH><TH>Objet</TH><TH>Date</TH><TH>Validité</TH><TH className="text-right">Total TTC</TH><TH>Statut</TH></TR>
          </THead>
          <TBody>
            {quotes.map((q) => (
              <TR key={q.id}>
                <TD>
                  <Link href={`/commercial/devis/${q.id}`} className="font-mono text-xs text-primary hover:underline">{q.reference}</Link>
                </TD>
                <TD>{q.client?.name ?? "—"}</TD>
                <TD>{q.subject ?? "—"}</TD>
                <TD className="whitespace-nowrap">{dateFr(q.issue_date)}</TD>
                <TD className="whitespace-nowrap">{dateFr(q.valid_until)}</TD>
                <TD className="text-right tabular-nums font-medium">{euros(q.total_cents)}</TD>
                <TD><StatusBadge status={q.status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
