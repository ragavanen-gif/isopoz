import Link from "next/link";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listOverdueInvoices } from "@/modules/invoices/queries";
import { addReminderAction } from "@/modules/invoices/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { dateFr, euros } from "@/lib/format";

export default async function RelancesPage() {
  await requirePermission("reminders.view");
  const user = await getSessionUser();
  const overdue = await listOverdueInvoices();
  const canRemind = user ? userCan(user, "reminders.send") : false;
  const totalOverdue = overdue.reduce((s, i) => s + (i.total_cents - i.paid_cents), 0);

  return (
    <>
      <PageHeader title="Relances" description={`${overdue.length} facture(s) en retard · ${euros(totalOverdue)} impayés`} />
      {overdue.length === 0 ? (
        <EmptyState message="Aucune facture en retard. 🎉" />
      ) : (
        <Table>
          <THead><TR><TH>Référence</TH><TH>Client</TH><TH>Échéance</TH><TH className="text-right">Restant dû</TH><TH></TH></TR></THead>
          <TBody>
            {overdue.map((i) => (
              <TR key={i.id}>
                <TD><Link href={`/commercial/factures/${i.id}`} className="font-mono text-xs text-primary hover:underline">{i.reference}</Link></TD>
                <TD>{i.client?.name ?? "—"}</TD>
                <TD className="whitespace-nowrap text-danger">{dateFr(i.due_date)}</TD>
                <TD className="text-right tabular-nums font-medium">{euros(i.total_cents - i.paid_cents)}</TD>
                <TD className="text-right">
                  {canRemind && (
                    <form action={addReminderAction.bind(null, i.id)}>
                      <Button type="submit" variant="secondary" size="sm">Relancer</Button>
                    </form>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
