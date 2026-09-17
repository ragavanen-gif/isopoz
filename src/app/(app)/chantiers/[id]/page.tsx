import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import {
  getProject, getProjectEmployees, getProjectEquipment, getProjectCosts,
  getProjectEvents, getProjectInvoice, computeMargin,
} from "@/modules/projects/queries";
import { createInvoiceFromProjectAction } from "@/modules/invoices/actions";
import {
  updateProjectAction, setProjectStatusAction, deleteProjectAction,
  assignEmployeeAction, removeProjectEmployeeAction, removeReservationAction,
  addCostAction, deleteCostAction,
} from "@/modules/projects/actions";
import { PROJECT_TRANSITIONS, PROJECT_STATUS_LABELS, COST_CATEGORIES, costCategoryLabel } from "@/modules/projects/constants";
import { ReserveEquipmentForm } from "@/modules/projects/reserve-equipment-form";
import { listEmployees } from "@/modules/employees/queries";
import { listEquipment } from "@/modules/equipment";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, StatCard } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { dateFr, dateTimeFr, euros } from "@/lib/format";

export default async function ProjectDetailPage({ params }: PageProps<"/chantiers/[id]"> ) {
  await requirePermission("projects.view");
  const user = await getSessionUser();
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const canEdit = user ? userCan(user, "projects.edit") : false;
  const canDelete = user ? userCan(user, "projects.delete") : false;

  const [emps, equip, costs, events, allEmployees, allEquipment, invoice] = await Promise.all([
    getProjectEmployees(id), getProjectEquipment(id), getProjectCosts(id), getProjectEvents(id),
    canEdit ? listEmployees() : Promise.resolve([]),
    canEdit ? listEquipment() : Promise.resolve([]),
    getProjectInvoice(id),
  ]);
  const margin = computeMargin(project.quote_total_cents, costs);
  const next = PROJECT_TRANSITIONS[project.status];
  const canInvoice = user ? userCan(user, "invoices.create") : false;
  const invoiceable = ["termine", "a_facturer", "facture"].includes(project.status);

  return (
    <>
      <PageHeader
        title={project.reference ?? "Chantier"}
        description={project.client?.name ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
            {project.quote?.id && (
              <Link href={`/commercial/devis/${project.quote.id}`}><Button variant="ghost" size="sm">Voir le devis</Button></Link>
            )}
            {canDelete && (
              <form action={deleteProjectAction.bind(null, id)}><Button type="submit" variant="secondary" size="sm">Supprimer</Button></form>
            )}
          </div>
        }
      />

      {/* Suivi des coûts / marge (CDC §20) */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Montant du devis" value={euros(project.quote_total_cents)} />
        <StatCard label="Coûts réels" value={euros(margin.totalCost)} tone="warning" />
        <StatCard label="Marge" value={euros(margin.margin)} tone={margin.margin >= 0 ? "success" : "danger"} />
        <StatCard label="Taux de marge" value={`${margin.rate} %`} tone={margin.margin >= 0 ? "success" : "danger"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Infos */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent>
            <form action={updateProjectAction.bind(null, id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Adresse" htmlFor="address" className="sm:col-span-2"><Input id="address" name="address" defaultValue={project.address ?? ""} disabled={!canEdit} /></Field>
              <Field label="Date de début" htmlFor="startDate"><Input id="startDate" name="startDate" type="date" defaultValue={project.start_date ?? ""} disabled={!canEdit} /></Field>
              <Field label="Fin prévue" htmlFor="endDatePlanned"><Input id="endDatePlanned" name="endDatePlanned" type="date" defaultValue={project.end_date_planned ?? ""} disabled={!canEdit} /></Field>
              <Field label="Fin réelle" htmlFor="endDateActual"><Input id="endDateActual" name="endDateActual" type="date" defaultValue={project.end_date_actual ?? ""} disabled={!canEdit} /></Field>
              <Field label="Description" htmlFor="description" className="sm:col-span-2"><Textarea id="description" name="description" defaultValue={project.description ?? ""} disabled={!canEdit} /></Field>
              <Field label="Notes" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" defaultValue={project.notes ?? ""} disabled={!canEdit} /></Field>
              {canEdit && <div className="sm:col-span-2"><Button type="submit" variant="secondary">Enregistrer</Button></div>}
            </form>
          </CardContent>
        </Card>

        {/* Workflow */}
        <Card>
          <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {canEdit && next.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {next.map((s) => (
                  <form key={s} action={setProjectStatusAction.bind(null, id, s)}>
                    <Button type="submit" variant="secondary" size="sm">{PROJECT_STATUS_LABELS[s]}</Button>
                  </form>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Aucune action disponible.</p>}
            {invoiceable && (
              <div className="border-t border-border pt-3">
                {invoice ? (
                  <Link href={`/commercial/factures/${invoice.id}`} className="text-sm font-medium text-primary underline">
                    Facture {invoice.reference} — voir
                  </Link>
                ) : canInvoice ? (
                  <form action={createInvoiceFromProjectAction.bind(null, id)}>
                    <Button type="submit" className="w-full">Créer la facture</Button>
                    <p className="mt-1 text-xs text-muted-foreground">Reprend les lignes du devis lié.</p>
                  </form>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Équipe */}
        <Card>
          <CardHeader><CardTitle>Équipe affectée</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {emps.length === 0 ? <p className="text-sm text-muted-foreground">Aucun salarié affecté.</p> : (
              <ul className="divide-y divide-border text-sm">
                {emps.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <span>{e.employee?.last_name} {e.employee?.first_name}{e.roleOnSite ? <span className="text-muted-foreground"> · {e.roleOnSite}</span> : null}</span>
                    {canEdit && <form action={removeProjectEmployeeAction.bind(null, id, e.id)}><Button type="submit" variant="ghost" size="sm">Retirer</Button></form>}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && allEmployees.length > 0 && (
              <form action={assignEmployeeAction.bind(null, id)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Salarié</label>
                  <Select name="employeeId" required defaultValue="" className="h-9 min-w-40">
                    <option value="" disabled>Sélectionner…</option>
                    {allEmployees.map((e) => <option key={e.id} value={e.id}>{e.last_name} {e.first_name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Rôle sur site</label>
                  <Input name="roleOnSite" className="h-9 w-36" placeholder="Ex : chef d'équipe" />
                </div>
                <Button type="submit" size="sm">Affecter</Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Matériel */}
        <Card>
          <CardHeader><CardTitle>Matériel réservé</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {equip.length === 0 ? <p className="text-sm text-muted-foreground">Aucune réservation.</p> : (
              <ul className="divide-y divide-border text-sm">
                {equip.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span>
                      {r.equipment?.name} ×{r.qty}
                      {r.reservedFrom && r.reservedTo ? <span className="text-muted-foreground"> · {dateFr(r.reservedFrom)} → {dateFr(r.reservedTo)}</span> : null}
                    </span>
                    {canEdit && <form action={removeReservationAction.bind(null, id, r.id)}><Button type="submit" variant="ghost" size="sm">Retirer</Button></form>}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && allEquipment.length > 0 && (
              <div className="border-t border-border pt-3">
                <ReserveEquipmentForm projectId={id} equipment={allEquipment.map((e) => ({ id: e.id, name: e.name, quantity: e.quantity }))} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coûts */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Coûts réels</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {costs.length === 0 ? <p className="text-sm text-muted-foreground">Aucun coût saisi.</p> : (
            <ul className="divide-y divide-border text-sm">
              {costs.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span><Badge className="mr-2">{costCategoryLabel(c.category)}</Badge>{c.label}<span className="text-muted-foreground"> · {dateFr(c.incurred_at)}</span></span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">{euros(c.amount_cents)}</span>
                    {canEdit && <form action={deleteCostAction.bind(null, id, c.id)}><Button type="submit" variant="ghost" size="sm">Suppr.</Button></form>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form action={addCostAction.bind(null, id)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Catégorie</label>
                <Select name="category" defaultValue="labor" className="h-9">
                  {COST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Libellé</label>
                <Input name="label" className="h-9 min-w-40" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Montant (€)</label>
                <Input name="amount" inputMode="decimal" className="h-9 w-28" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Date</label>
                <Input name="incurredAt" type="date" className="h-9" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <Button type="submit" size="sm">Ajouter</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Historique du chantier</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? <p className="text-sm text-muted-foreground">Aucun évènement.</p> : (
            <ul className="space-y-2 text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <span className="whitespace-nowrap text-muted-foreground">{dateTimeFr(ev.at)}</span>
                  <span>{ev.message}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
