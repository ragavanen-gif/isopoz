import Link from "next/link";
import { requirePermission } from "@/core/auth/session";
import { listAllPayments } from "@/modules/invoices/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { dateFr, euros } from "@/lib/format";

export default async function PaiementsPage() {
  await requirePermission("payments.view");
  const payments = await listAllPayments();
  const total = payments.reduce((s, p) => s + p.amountCents, 0);

  return (
    <>
      <PageHeader title="Paiements" description={`${payments.length} paiement(s) · ${euros(total)} encaissés`} />
      {payments.length === 0 ? (
        <EmptyState message="Aucun paiement enregistré." />
      ) : (
        <Table>
          <THead><TR><TH>Date</TH><TH>Facture</TH><TH>Client</TH><TH>Moyen</TH><TH className="text-right">Montant</TH></TR></THead>
          <TBody>
            {payments.map((p) => (
              <TR key={p.id}>
                <TD className="whitespace-nowrap">{dateFr(p.paidAt)}</TD>
                <TD>{p.invoice ? <Link href={`/commercial/factures/${p.invoice.id}`} className="font-mono text-xs text-primary hover:underline">{p.invoice.reference}</Link> : "—"}</TD>
                <TD>{p.client?.name ?? "—"}</TD>
                <TD>{p.method ?? "—"}</TD>
                <TD className="text-right tabular-nums font-medium">{euros(p.amountCents)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
