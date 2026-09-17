import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listEphemeralsWithTotals } from "@/modules/employees/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { euros } from "@/lib/format";

export default async function EphemeresPage() {
  await requirePermission("ephemeral.view");
  const user = await getSessionUser();
  const rows = await listEphemeralsWithTotals();
  const canCreate = user ? userCan(user, "employees.create") : false;

  return (
    <>
      <PageHeader
        title="Salariés éphémères"
        description="Payés à la journée — suivi des journées validées et de la rémunération."
        actions={canCreate && (
          <Link href="/personnel/salaries/nouveau?type=ephemere"><Button><Plus /> Nouvel éphémère</Button></Link>
        )}
      />
      {rows.length === 0 ? (
        <EmptyState message="Aucun salarié éphémère." />
      ) : (
        <Table>
          <THead><TR><TH>Nom</TH><TH>Tarif / jour</TH><TH className="text-right">Jours validés</TH><TH className="text-right">En attente</TH><TH className="text-right">Rémunération</TH></TR></THead>
          <TBody>
            {rows.map(({ employee: e, validated, pending, payCents }) => (
              <TR key={e.id}>
                <TD>
                  <Link href={`/personnel/salaries/${e.id}`} className="font-medium text-primary hover:underline">
                    {e.last_name.toUpperCase()} {e.first_name}
                  </Link>
                </TD>
                <TD>{e.daily_rate_cents != null ? euros(e.daily_rate_cents) : "—"}</TD>
                <TD className="text-right tabular-nums">{validated}</TD>
                <TD className="text-right tabular-nums text-muted-foreground">{pending}</TD>
                <TD className="text-right tabular-nums font-medium">{euros(payCents)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
