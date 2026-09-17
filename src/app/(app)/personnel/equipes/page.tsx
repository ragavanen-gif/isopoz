import Link from "next/link";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listTeams } from "@/modules/teams";
import { TeamCreateForm } from "@/modules/teams/team-create-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/table";

export default async function EquipesPage() {
  await requirePermission("teams.view");
  const user = await getSessionUser();
  const teams = await listTeams();
  const canCreate = user ? userCan(user, "teams.create") : false;

  return (
    <>
      <PageHeader title="Équipes" description={`${teams.length} équipe(s)`} />
      {canCreate && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Nouvelle équipe</CardTitle></CardHeader>
          <CardContent><TeamCreateForm /></CardContent>
        </Card>
      )}
      {teams.length === 0 ? (
        <EmptyState message="Aucune équipe." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Link key={t.id} href={`/personnel/equipes/${t.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-primary">
                <p className="font-semibold">{t.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chef : {t.lead ? `${t.lead.first_name} ${t.lead.last_name}` : "—"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {t.members.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Aucun membre</span>
                  ) : (
                    t.members.map((m) => <Badge key={m.employee_id}>{m.first_name} {m.last_name}</Badge>)
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
