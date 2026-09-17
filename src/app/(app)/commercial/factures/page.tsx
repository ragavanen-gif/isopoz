import Link from "next/link";
import { requirePermission } from "@/core/auth/session";
import { listInvoices } from "@/modules/invoices/queries";
import { INVOICE_STATUS_LABELS } from "@/modules/invoices/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { dateFr, euros } from "@/lib/format";

export default async function FacturesPage({ searchParams }: PageProps<"/commercial/factures">) {
  await requirePermission("invoices.view");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const invoices = await listInvoices(status);
  const totalDue = invoices.reduce((s, i) => s + (i.total_cents - i.paid_cents), 0);

  return (
    <>
      <PageHeader
        title="Factures"
        description={`${invoices.length} facture(s) · reste à encaisser ${euros(totalDue)}`}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/commercial/factures" className={!status ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>Toutes</Link>
        {Object.entries(INVOICE_STATUS_LABELS).map(([key, label]) => (
          <Link key={key} href={`/commercial/factures?status=${key}`} className={status === key ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>{label}</Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <EmptyState message="Aucune facture. Créez-en une depuis un chantier terminé." />
      ) : (
        <Table>
          <THead><TR><TH>Référence</TH><TH>Client</TH><TH>Émise</TH><TH>Échéance</TH><TH className="text-right">Total TTC</TH><TH className="text-right">Réglé</TH><TH>Statut</TH></TR></THead>
          <TBody>
            {invoices.map((i) => (
              <TR key={i.id}>
                <TD><Link href={`/commercial/factures/${i.id}`} className="font-mono text-xs text-primary hover:underline">{i.reference}</Link></TD>
                <TD>{i.client?.name ?? "—"}</TD>
                <TD className="whitespace-nowrap">{dateFr(i.issue_date)}</TD>
                <TD className="whitespace-nowrap">{dateFr(i.due_date)}</TD>
                <TD className="text-right tabular-nums">{euros(i.total_cents)}</TD>
                <TD className="text-right tabular-nums text-muted-foreground">{euros(i.paid_cents)}</TD>
                <TD><StatusBadge status={i.effective_status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
