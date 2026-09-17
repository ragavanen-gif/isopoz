import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listSchedules } from "@/modules/planning/queries";
import { CreateScheduleForm, AssignForm } from "@/modules/planning/planning-forms";
import { removeAssignmentAction, deleteScheduleAction } from "@/modules/planning/actions";
import { listProjects } from "@/modules/projects/queries";
import { listEmployees } from "@/modules/employees/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/table";
import { dateFr } from "@/lib/format";

export default async function PlanningPage() {
  await requirePermission("planning.view");
  const user = await getSessionUser();
  const canEdit = user ? userCan(user, "planning.edit") : false;
  const canCreate = user ? userCan(user, "planning.create") : false;

  const [schedules, projects, employees] = await Promise.all([
    listSchedules(),
    canCreate ? listProjects() : Promise.resolve([]),
    canEdit ? listEmployees() : Promise.resolve([]),
  ]);

  const projectOpts = projects
    .filter((p) => !["cloture", "annule"].includes(p.status))
    .map((p) => ({ id: p.id, label: `${p.reference ?? ""} — ${p.client?.name ?? ""}` }));
  const employeeOpts = employees.map((e) => ({ id: e.id, label: `${e.last_name} ${e.first_name}` }));

  // Regroupe par date pour l'affichage.
  const byDate = new Map<string, typeof schedules>();
  for (const s of schedules) {
    const arr = byDate.get(s.date) ?? [];
    arr.push(s);
    byDate.set(s.date, arr);
  }

  return (
    <>
      <PageHeader title="Planning" description="Créneaux à venir. Les conflits d'affectation sont détectés automatiquement." />

      {canCreate && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Nouveau créneau</CardTitle></CardHeader>
          <CardContent>
            {projectOpts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun chantier planifiable. Créez d'abord un chantier.</p>
            ) : (
              <CreateScheduleForm projects={projectOpts} />
            )}
          </CardContent>
        </Card>
      )}

      {schedules.length === 0 ? (
        <EmptyState message="Aucun créneau à venir." />
      ) : (
        <div className="space-y-6">
          {Array.from(byDate.entries()).map(([date, list]) => (
            <div key={date}>
              <h2 className="mb-2 text-sm font-semibold capitalize">{dateFr(date, "EEEE d MMMM yyyy")}</h2>
              <div className="space-y-3">
                {list.map((s) => (
                  <Card key={s.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {s.project?.reference ?? "Chantier"} · {s.project?.client?.name ?? ""}
                        </p>
                        <p className="text-sm text-muted-foreground">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.assignments.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Aucun salarié affecté</span>
                          ) : (
                            s.assignments.map((a) => (
                              <span key={a.id} className="inline-flex items-center gap-1">
                                <Badge>{a.employee?.first_name} {a.employee?.last_name}</Badge>
                                {canEdit && (
                                  <form action={removeAssignmentAction.bind(null, a.id)}>
                                    <button type="submit" className="text-xs text-muted-foreground hover:text-danger">×</button>
                                  </form>
                                )}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={deleteScheduleAction.bind(null, s.id)}>
                          <Button type="submit" variant="ghost" size="sm">Supprimer</Button>
                        </form>
                      )}
                    </div>
                    {canEdit && employeeOpts.length > 0 && (
                      <div className="mt-3 border-t border-border pt-3">
                        <AssignForm scheduleId={s.id} employees={employeeOpts} />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
