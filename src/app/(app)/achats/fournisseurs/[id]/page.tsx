import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getSupplier } from "@/modules/suppliers";
import { deleteSupplierAction } from "@/modules/suppliers/actions";
import { listSupplierOrders } from "@/modules/orders/queries";
import { PO_STATUS_LABELS } from "@/modules/orders/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { euros, dateFr } from "@/lib/format";

export default async function SupplierDetailPage({ params }: PageProps<"/achats/fournisseurs/[id]"> ) {
  await requirePermission("suppliers.view");
  const user = await getSessionUser();
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  const orders = await listSupplierOrders(id);

  const canEdit = user ? userCan(user, "suppliers.edit") : false;
  const canDelete = user ? userCan(user, "suppliers.delete") : false;

  return (
    <>
      <PageHeader
        title={supplier.name}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && <Link href={`/achats/fournisseurs/${id}/modifier`}><Button variant="secondary"><Pencil /> Modifier</Button></Link>}
            {canDelete && <form action={deleteSupplierAction.bind(null, id)}><Button type="submit" variant="secondary" size="sm">Supprimer</Button></form>}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Info label="Contact">{supplier.contact ?? "—"}</Info>
            <Info label="Email">{supplier.email ?? "—"}</Info>
            <Info label="Téléphone">{supplier.phone ?? "—"}</Info>
            <Info label="Conditions de paiement">{supplier.payment_terms ?? "—"}</Info>
            <Info label="Adresse">{supplier.address ?? "—"}</Info>
            <Info label="SIRET">{supplier.siret ?? "—"}</Info>
            <Info label="N° TVA">{supplier.vat_number ?? "—"}</Info>
            {supplier.notes && <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap">{supplier.notes}</p></div>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Commandes</CardTitle></CardHeader>
        <CardContent>
          {orders.length === 0 ? <p className="text-sm text-muted-foreground">Aucune commande.</p> : (
            <Table>
              <THead><TR><TH>Référence</TH><TH>Date</TH><TH className="text-right">Total</TH><TH>Statut</TH></TR></THead>
              <TBody>
                {orders.map((o) => (
                  <TR key={o.id}>
                    <TD><Link href={`/achats/commandes/${o.id}`} className="font-mono text-xs text-primary hover:underline">{o.reference}</Link></TD>
                    <TD>{dateFr(o.created_at)}</TD>
                    <TD className="text-right tabular-nums">{euros(o.negotiated_total_cents ?? o.initial_total_cents)}</TD>
                    <TD><span className="text-sm">{PO_STATUS_LABELS[o.status] ?? o.status}</span></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}
