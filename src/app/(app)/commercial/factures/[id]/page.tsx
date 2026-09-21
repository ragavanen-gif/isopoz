import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import {
  getInvoice, getInvoiceItems, getInvoicePayments, getInvoiceReminders,
} from "@/modules/invoices/queries";
import {
  updateInvoiceMetaAction, sendInvoiceAction, recordPaymentAction,
  deletePaymentAction, addReminderAction, deleteInvoiceAction,
} from "@/modules/invoices/actions";
import { sendInvoiceByEmailAction, sendReminderByEmailAction } from "@/modules/invoices/email-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, StatCard } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dateFr, dateTimeFr, euros, vatLabel } from "@/lib/format";

export default async function InvoiceDetailPage({ params }: PageProps<"/commercial/factures/[id]"> ) {
  await requirePermission("invoices.view");
  const user = await getSessionUser();
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const [items, payments, reminders] = await Promise.all([
    getInvoiceItems(id), getInvoicePayments(id), getInvoiceReminders(id),
  ]);

  const canEdit = user ? userCan(user, "invoices.edit") : false;
  const canSend = user ? userCan(user, "invoices.send") : false;
  const canPay = user ? userCan(user, "payments.create") : false;
  const canDeletePay = user ? userCan(user, "payments.delete") : false;
  const canRemind = user ? userCan(user, "reminders.send") : false;
  const canDelete = user ? userCan(user, "invoices.delete") : false;
  const remaining = invoice.total_cents - invoice.paid_cents;

  return (
    <>
      <PageHeader
        title={invoice.reference ?? "Facture"}
        description={invoice.client?.name ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={invoice.effective_status} />
            {canSend && (
              <AsyncActionButton
                action={sendInvoiceByEmailAction.bind(null, id)}
                label="Envoyer par email"
                pendingLabel="Envoi…"
                successMessage="Facture envoyée au client."
                variant="primary"
              />
            )}
            {canSend && invoice.status === "brouillon" && (
              <form action={sendInvoiceAction.bind(null, id)}><Button type="submit" variant="secondary" size="sm">Marquer envoyée</Button></form>
            )}
            {invoice.project_id && <Link href={`/chantiers/${invoice.project_id}`}><Button variant="ghost" size="sm">Chantier</Button></Link>}
            {canDelete && <form action={deleteInvoiceAction.bind(null, id)}><Button type="submit" variant="secondary" size="sm">Supprimer</Button></form>}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Total TTC" value={euros(invoice.total_cents)} />
        <StatCard label="Réglé" value={euros(invoice.paid_cents)} tone="success" />
        <StatCard label="Restant dû" value={euros(remaining)} tone={remaining > 0 ? "warning" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? <p className="text-sm text-muted-foreground">Aucune ligne.</p> : (
              <Table>
                <THead><TR><TH>Désignation</TH><TH className="text-right">Qté</TH><TH className="text-right">PU HT</TH><TH className="text-right">TVA</TH><TH className="text-right">Total HT</TH></TR></THead>
                <TBody>
                  {items.map((it) => (
                    <TR key={it.id}>
                      <TD>{it.label}</TD>
                      <TD className="text-right">{it.qty}</TD>
                      <TD className="text-right tabular-nums">{euros(it.unit_price_cents)}</TD>
                      <TD className="text-right">{vatLabel(it.vat_bps)}</TD>
                      <TD className="text-right tabular-nums">{euros(it.line_total_cents)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
            <div className="mt-3 flex flex-col items-end gap-1 text-sm">
              <div className="flex w-56 justify-between"><span className="text-muted-foreground">Total HT</span><span className="tabular-nums">{euros(invoice.subtotal_cents)}</span></div>
              <div className="flex w-56 justify-between"><span className="text-muted-foreground">TVA</span><span className="tabular-nums">{euros(invoice.vat_cents)}</span></div>
              <div className="flex w-56 justify-between text-base font-semibold"><span>Total TTC</span><span className="tabular-nums">{euros(invoice.total_cents)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent>
            <form action={updateInvoiceMetaAction.bind(null, id)} className="space-y-3">
              <Field label="Date d'émission" htmlFor="issueDate"><Input id="issueDate" name="issueDate" type="date" defaultValue={invoice.issue_date} disabled={!canEdit} /></Field>
              <Field label="Échéance" htmlFor="dueDate"><Input id="dueDate" name="dueDate" type="date" defaultValue={invoice.due_date ?? ""} disabled={!canEdit} /></Field>
              <Field label="Conditions" htmlFor="paymentTerms"><Input id="paymentTerms" name="paymentTerms" defaultValue={invoice.payment_terms ?? ""} disabled={!canEdit} /></Field>
              <Field label="Notes" htmlFor="notes"><Textarea id="notes" name="notes" defaultValue={invoice.notes ?? ""} disabled={!canEdit} /></Field>
              {canEdit && <Button type="submit" variant="secondary" size="sm">Enregistrer</Button>}
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Paiements</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun paiement.</p> : (
              <ul className="divide-y divide-border text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span>{dateFr(p.paid_at)}{p.method ? <span className="text-muted-foreground"> · {p.method}</span> : null}</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums font-medium">{euros(p.amount_cents)}</span>
                      {canDeletePay && <form action={deletePaymentAction.bind(null, id, p.id)}><Button type="submit" variant="ghost" size="sm">Suppr.</Button></form>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canPay && invoice.status !== "brouillon" && remaining > 0 && (
              <form action={recordPaymentAction.bind(null, id)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <div className="space-y-1"><label className="text-xs text-muted-foreground">Montant (€)</label><Input name="amount" inputMode="decimal" className="h-9 w-28" required /></div>
                <div className="space-y-1"><label className="text-xs text-muted-foreground">Date</label><Input name="paidAt" type="date" className="h-9" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
                <div className="space-y-1"><label className="text-xs text-muted-foreground">Moyen</label>
                  <Select name="method" className="h-9"><option value="">—</option><option>Virement</option><option>Chèque</option><option>Espèces</option><option>CB</option></Select>
                </div>
                <Button type="submit" size="sm">Enregistrer</Button>
              </form>
            )}
            {invoice.status === "brouillon" && <p className="text-xs text-muted-foreground">Marquez la facture « envoyée » pour enregistrer des paiements.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Relances</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {reminders.length === 0 ? <p className="text-sm text-muted-foreground">Aucune relance.</p> : (
              <ul className="divide-y divide-border text-sm">
                {reminders.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span><Badge tone="warning">Relance {r.level}</Badge>{r.note ? <span className="ml-2 text-muted-foreground">{r.note}</span> : null}</span>
                    <span className="text-muted-foreground">{dateTimeFr(r.sent_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {canRemind && invoice.effective_status !== "payee" && (
              <div className="space-y-3 border-t border-border pt-3">
                <AsyncActionButton
                  action={sendReminderByEmailAction.bind(null, id, undefined)}
                  label="Relancer par email"
                  pendingLabel="Envoi…"
                  successMessage="Relance envoyée au client par email."
                  variant="primary"
                />
                <form action={addReminderAction.bind(null, id)} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1"><label className="text-xs text-muted-foreground">Relance manuelle (sans email)</label><Input name="note" className="h-9" placeholder="Commentaire" /></div>
                  <Button type="submit" size="sm" variant="secondary">Enregistrer</Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
