import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listOrders } from "@/modules/orders/queries";
import { PO_STATUS_LABELS, poStatusTone } from "@/modules/orders/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dateFr, euros } from "@/lib/format";

export default async function CommandesPage({ searchParams }: PageProps<"/achats/commandes">) {
  await requirePermission("orders.view");
  const user = await getSessionUser();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const orders = await listOrders(status);
  const canCreate = user ? userCan(user, "orders.create") : false;

  return (
    <>
      <PageHeader
        title="Commandes"
        description={`${orders.length} commande(s)`}
        actions={canCreate && (<Link href="/achats/commandes/nouveau"><Button><Plus /> Nouvelle commande</Button></Link>)}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/achats/commandes" className={!status ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>Toutes</Link>
        {Object.entries(PO_STATUS_LABELS).map(([key, label]) => (
          <Link key={key} href={`/achats/commandes?status=${key}`} className={status === key ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>{label}</Link>
        ))}
      </div>
      {orders.length === 0 ? (
        <EmptyState message="Aucune commande." />
      ) : (
        <Table>
          <THead><TR><TH>Référence</TH><TH>Fournisseur</TH><TH>Date</TH><TH className="text-right">Total initial</TH><TH className="text-right">Négocié</TH><TH>Statut</TH></TR></THead>
          <TBody>
            {orders.map((o) => (
              <TR key={o.id}>
                <TD><Link href={`/achats/commandes/${o.id}`} className="font-mono text-xs text-primary hover:underline">{o.reference}</Link></TD>
                <TD>{o.supplier?.name ?? "—"}</TD>
                <TD className="whitespace-nowrap">{dateFr(o.created_at)}</TD>
                <TD className="text-right tabular-nums">{euros(o.initial_total_cents)}</TD>
                <TD className="text-right tabular-nums">{o.negotiated_total_cents != null ? euros(o.negotiated_total_cents) : "—"}</TD>
                <TD><Badge tone={poStatusTone(o.status)}>{PO_STATUS_LABELS[o.status]}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
