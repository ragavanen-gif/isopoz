import { requirePermission } from "@/core/auth/session";
import { getMyLeaveRequests, getMyMaterialRequests } from "@/modules/portal/queries";
import { LeaveRequestForm, MaterialRequestForm } from "@/modules/portal/request-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { dateFr } from "@/lib/format";

export default async function PortailDemandesPage() {
  const user = await requirePermission("portal.self");
  if (!user.employeeId) {
    return (
      <>
        <PageHeader title="Mes demandes" />
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Compte non relié à une fiche salarié.</CardContent></Card>
      </>
    );
  }
  const [leaves, materials] = await Promise.all([getMyLeaveRequests(user.employeeId), getMyMaterialRequests(user.employeeId)]);

  return (
    <>
      <PageHeader title="Mes demandes" description="Repos/absence et matériel." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Demander un repos / une absence</CardTitle></CardHeader>
            <CardContent><LeaveRequestForm /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mes demandes de repos/absence</CardTitle></CardHeader>
            <CardContent>
              {leaves.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande.</p> : (
                <ul className="divide-y divide-border text-sm">
                  {leaves.map((l) => (
                    <li key={l.id} className="flex items-center justify-between py-2">
                      <span>{l.kind === "absence" ? "Absence" : "Repos"} · {dateFr(l.date_from)} → {dateFr(l.date_to)}</span>
                      <StatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Demander du matériel</CardTitle></CardHeader>
            <CardContent><MaterialRequestForm /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mes demandes de matériel</CardTitle></CardHeader>
            <CardContent>
              {materials.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande.</p> : (
                <ul className="divide-y divide-border text-sm">
                  {materials.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2">
                      <span>{m.qty} × {m.label}{m.projectRef ? ` (${m.projectRef})` : ""}</span>
                      <StatusBadge status={m.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
