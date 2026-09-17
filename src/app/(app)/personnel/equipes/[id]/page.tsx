import { notFound } from "next/navigation";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getTeam } from "@/modules/teams";
import { listEmployees } from "@/modules/employees/queries";
import { updateTeamAction, setTeamMembersAction, deleteTeamAction } from "@/modules/teams/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function TeamDetailPage({ params }: PageProps<"/personnel/equipes/[id]"> ) {
  await requirePermission("teams.view");
  const user = await getSessionUser();
  const { id } = await params;
  const [team, employees] = await Promise.all([getTeam(id), listEmployees(["cdi", "cdd"])]);
  if (!team) notFound();

  const canEdit = user ? userCan(user, "teams.edit") : false;
  const canDelete = user ? userCan(user, "teams.delete") : false;
  const memberSet = new Set(team.members.map((m) => m.employee_id));

  return (
    <>
      <PageHeader
        title={team.name}
        description="Composition de l'équipe"
        actions={canDelete && (
          <form action={deleteTeamAction.bind(null, id)}><Button type="submit" variant="secondary" size="sm">Supprimer</Button></form>
        )}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent>
            <form action={updateTeamAction.bind(null, id)} className="space-y-4">
              <Field label="Nom" htmlFor="name"><Input id="name" name="name" defaultValue={team.name} disabled={!canEdit} /></Field>
              <Field label="Chef d'équipe" htmlFor="teamLeadId">
                <Select id="teamLeadId" name="teamLeadId" defaultValue={team.team_lead_id ?? ""} disabled={!canEdit}>
                  <option value="">—</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.last_name} {e.first_name}</option>)}
                </Select>
              </Field>
              {canEdit && <Button type="submit">Enregistrer</Button>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Membres</CardTitle></CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun salarié CDI/CDD à affecter.</p>
            ) : (
              <form action={setTeamMembersAction.bind(null, id)} className="space-y-3">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {employees.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="memberIds" value={e.id} defaultChecked={memberSet.has(e.id)} disabled={!canEdit} className="size-4" />
                      {e.last_name} {e.first_name}
                    </label>
                  ))}
                </div>
                {canEdit && <Button type="submit">Enregistrer les membres</Button>}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
