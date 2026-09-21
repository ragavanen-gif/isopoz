import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getOrder, getOrderItems, getNegotiations } from "@/modules/orders/queries";
import {
  setOrderStatusAction, updateOrderNotesAction, addNegotiationAction,
  setNegotiatedTotalAction, deleteOrderAction,
} from "@/modules/orders/actions";
import { PO_TRANSITIONS, PO_STATUS_LABELS, PO_EDITABLE_STATUSES, poStatusTone } from "@/modules/orders/constants";
import { PoItemsEditor } from "@/modules/orders/po-items-editor";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dateFr, euros } from "@/lib/format";

export default async function OrderDetailPage({ params }: PageProps<"/achats/commandes/[id]"> ) {
  await requirePermission("orders.view");
  const user = await getSessionUser();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const [items, negotiations] = await Promise.all([getOrderItems(id), getNegotiations(id)]);

  const canEdit = user ? userCan(user, "orders.edit") : false;
  const canDelete = user ? userCan(user, "orders.delete") : false;
  const canNegotiate = user ? userCan(user, "negotiations.create") : false;
  const editable = canEdit && PO_EDITABLE_STATUSES.includes(order.status);
  const next = PO_TRANSITIONS[order.status];

  const finalCents = order.negotiated_total_cents ?? order.initial_total_cents;
  const economy = order.negotiated_total_cents != null ? order.initial_total_cents - order.negotiated_total_cents : 0;

  return (
    <>
      <PageHeader
        title={order.reference ?? "Commande"}
        description={order.supplier?.name ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={poStatusTone(order.status)}>{PO_STATUS_LABELS[order.status]}</Badge>
            {order.supplier?.id && <Link href={`/achats/fournisseurs/${order.supplier.id}`}><Button variant="ghost" size="sm">Fournisseur</Button></Link>}
            {canDelete && <form action={deleteOrderAction.bind(null, id)}><Button type="submit" variant="secondary" size="sm">Supprimer</Button></form>}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Prix initial" value={euros(order.initial_total_cents)} />
        <StatCard label="Prix final" value={euros(finalCents)} />
        <StatCard label="Économie" value={euros(economy)} tone={economy > 0 ? "success" : "default"} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Lignes de la commande</CardTitle></CardHeader>
          <CardContent><PoItemsEditor poId={id} initialItems={items} editable={editable} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {canEdit && next.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {next.map((s) => (
                  <form key={s} action={setOrderStatusAction.bind(null, id, s)}>
                    <Button type="submit" variant="secondary" size="sm">{PO_STATUS_LABELS[s]}</Button>
                  </form>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Aucune action.</p>}
            <form action={updateOrderNotesAction.bind(null, id)} className="space-y-2 border-t border-border pt-3">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea name="notes" defaultValue={order.notes ?? ""} disabled={!canEdit} className="min-h-20" />
              {canEdit && <Button type="submit" variant="secondary" size="sm">Enregistrer</Button>}
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Négociation</CardTitle>
          <p className="text-xs text-muted-foreground">Historique des échanges de prix (CDC §27).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {negotiations.length === 0 ? <p className="text-sm text-muted-foreground">Aucune étape de négociation.</p> : (
            <ul className="space-y-2 text-sm">
              {negotiations.map((n) => (
                <li key={n.id} className="flex items-center justify-between border-b border-border pb-2">
                  <span>
                    <span className="text-muted-foreground">{dateFr(n.at)}</span>{" · "}
                    <Badge tone={n.party === "supplier" ? "warning" : "primary"}>{n.party === "supplier" ? "Fournisseur" : "ISOPoz"}</Badge>
                    {n.note ? <span className="ml-2 text-muted-foreground">{n.note}</span> : null}
                  </span>
                  <span className="tabular-nums font-medium">{euros(n.amount_cents)}</span>
                </li>
              ))}
            </ul>
          )}

          {canNegotiate && order.status !== "recue" && order.status !== "annulee" && (
            <form action={addNegotiationAction.bind(null, id)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div className="space-y-1"><label className="text-xs text-muted-foreground">Partie</label>
                <Select name="party" defaultValue="isopoz" className="h-9"><option value="isopoz">ISOPoz</option><option value="supplier">Fournisseur</option></Select>
              </div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground">Montant (€)</label><Input name="amount" inputMode="decimal" className="h-9 w-28" required /></div>
              <div className="space-y-1"><label className="text-xs text-muted-foreground">Date</label><Input name="at" type="date" className="h-9" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div className="space-y-1 flex-1"><label className="text-xs text-muted-foreground">Note</label><Input name="note" className="h-9" placeholder="Commentaire" /></div>
              <Button type="submit" size="sm">Ajouter</Button>
            </form>
          )}

          {canEdit && (
            <form action={setNegotiatedTotalAction.bind(null, id)} className="flex items-end gap-2 border-t border-border pt-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Prix final négocié (accord) — € HT</label>
                <Input name="finalAmount" inputMode="decimal" className="h-9 w-40" defaultValue={order.negotiated_total_cents != null ? (order.negotiated_total_cents / 100).toString() : ""} />
              </div>
              <Button type="submit" variant="secondary" size="sm">Enregistrer l'accord</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </>
  );
}
