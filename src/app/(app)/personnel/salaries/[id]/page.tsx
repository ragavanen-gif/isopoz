import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getEmployee, listWorkdays, workdaySummary } from "@/modules/employees/queries";
import {
  deleteEmployeeAction, addWorkdayAction, setWorkdayStatusAction, deleteWorkdayAction,
} from "@/modules/employees/actions";
import { employeeTypeLabel, WORKDAY_STATUS_LABELS } from "@/modules/employees/schema";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dateFr, euros } from "@/lib/format";

export default async function EmployeeDetailPage({ params }: PageProps<"/personnel/salaries/[id]"> ) {
  await requirePermission("employees.view");
  const user = await getSessionUser();
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const isEph = employee.type === "ephemere";
  const workdays = isEph ? await listWorkdays(id) : [];
  const summary = workdaySummary(workdays, employee.daily_rate_cents);

  const canEdit = user ? userCan(user, "employees.edit") : false;
  const canDelete = user ? userCan(user, "employees.delete") : false;
  const canAddDay = user ? userCan(user, "ephemeral.create") : false;
  const canEditDay = user ? userCan(user, "ephemeral.edit") : false;
  const canValidate = user ? userCan(user, "ephemeral.validate") : false;

  return (
    <>
      <PageHeader
        title={`${employee.last_name.toUpperCase()} ${employee.first_name}`}
        description={employeeTypeLabel(employee.type)}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link href={`/personnel/salaries/${id}/modifier`}><Button variant="secondary"><Pencil /> Modifier</Button></Link>
            )}
            {canDelete && (
              <form action={deleteEmployeeAction.bind(null, id)}>
                <Button type="submit" variant="secondary" size="sm">Supprimer</Button>
              </form>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className={isEph ? "lg:col-span-1" : "lg:col-span-3"}>
          <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Info label="Type"><Badge tone={isEph ? "warning" : "info"}>{employeeTypeLabel(employee.type)}</Badge></Info>
            <Info label="Statut">{employee.status === "active" ? "Actif" : "Inactif"}</Info>
            <Info label="Email">{employee.email ?? "—"}</Info>
            <Info label="Téléphone">{employee.phone ?? "—"}</Info>
            {isEph && <Info label="Tarif journalier">{employee.daily_rate_cents != null ? euros(employee.daily_rate_cents) : "—"}</Info>}
            {employee.notes && <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap">{employee.notes}</p></div>}
          </CardContent>
        </Card>

        {isEph && (
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Jours validés" value={summary.validated.toString()} />
              <StatCard label="En attente" value={summary.pending.toString()} tone="warning" />
              <StatCard label="Rémunération" value={euros(summary.payCents)} tone="success" />
            </div>

            <Card>
              <CardHeader><CardTitle>Journées</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {canAddDay && (
                  <form action={addWorkdayAction.bind(null, id)} className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Date</label>
                      <Input name="date" type="date" required className="h-9" defaultValue={new Date().toISOString().slice(0, 10)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Fraction</label>
                      <Select name="fraction" defaultValue="1" className="h-9 w-28">
                        <option value="1">1 journée</option>
                        <option value="0.5">½ journée</option>
                      </Select>
                    </div>
                    <Button type="submit" size="sm">Ajouter</Button>
                  </form>
                )}

                {workdays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune journée enregistrée.</p>
                ) : (
                  <Table>
                    <THead><TR><TH>Date</TH><TH>Fraction</TH><TH>Statut</TH><TH></TH></TR></THead>
                    <TBody>
                      {workdays.map((w) => (
                        <TR key={w.id}>
                          <TD className="whitespace-nowrap">{dateFr(w.date)}</TD>
                          <TD>{Number(w.fraction) === 0.5 ? "½ jour" : "1 jour"}</TD>
                          <TD><Badge tone={["validee", "comptabilisee"].includes(w.status) ? "success" : w.status === "a_valider" ? "warning" : "neutral"}>{WORKDAY_STATUS_LABELS[w.status] ?? w.status}</Badge></TD>
                          <TD className="text-right">
                            <div className="flex justify-end gap-1">
                              {canEditDay && w.status !== "a_valider" && !["validee", "comptabilisee"].includes(w.status) && (
                                <form action={setWorkdayStatusAction.bind(null, id, w.id, "a_valider")}>
                                  <Button type="submit" variant="ghost" size="sm">À valider</Button>
                                </form>
                              )}
                              {canValidate && !["validee", "comptabilisee"].includes(w.status) && (
                                <form action={setWorkdayStatusAction.bind(null, id, w.id, "validee")}>
                                  <Button type="submit" variant="secondary" size="sm">Valider</Button>
                                </form>
                              )}
                              {canEditDay && (
                                <form action={deleteWorkdayAction.bind(null, id, w.id)}>
                                  <Button type="submit" variant="ghost" size="sm">Suppr.</Button>
                                </form>
                              )}
                            </div>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {!isEph && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Documents RH & fiches de paie</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            La gestion des documents RH (contrats, fiches de paie) et le portail salarié
            seront ajoutés prochainement, avec un cloisonnement strict des accès (docs/02).
          </CardContent>
        </Card>
      )}
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
