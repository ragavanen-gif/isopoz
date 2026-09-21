import Link from "next/link";
import { CalendarDays, FileText, Wallet } from "lucide-react";
import { requirePermission } from "@/core/auth/session";
import { getMyEmployee, getMyPlanning } from "@/modules/portal/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { dateFr } from "@/lib/format";

export default async function PortailPage() {
  const user = await requirePermission("portal.self");

  if (!user.employeeId) {
    return (
      <>
        <PageHeader title="Mon espace" />
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Votre compte n'est pas encore relié à une fiche salarié. Contactez un administrateur.
        </CardContent></Card>
      </>
    );
  }

  const [employee, planning] = await Promise.all([getMyEmployee(user.employeeId), getMyPlanning(user.employeeId)]);
  const next7 = planning.slice(0, 10);

  return (
    <>
      <PageHeader
        title={`Bonjour ${employee?.first_name ?? ""}`.trim()}
        description="Votre espace personnel."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/portail"><Card className="flex items-center gap-3 p-5 hover:border-primary"><CalendarDays className="size-6 text-primary" /><span className="font-medium">Mon planning</span></Card></Link>
        <Link href="/portail/demandes"><Card className="flex items-center gap-3 p-5 hover:border-primary"><FileText className="size-6 text-primary" /><span className="font-medium">Mes demandes</span></Card></Link>
        <Link href="/portail/paie"><Card className="flex items-center gap-3 p-5 hover:border-primary"><Wallet className="size-6 text-primary" /><span className="font-medium">Mes fiches de paie</span></Card></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Mon planning à venir</CardTitle></CardHeader>
        <CardContent>
          {next7.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun créneau planifié pour le moment.</p>
          ) : (
            <ul className="divide-y divide-border">
              {next7.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium capitalize">{dateFr(s.date, "EEEE d MMMM")}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                      {s.clientName ? ` · ${s.clientName}` : ""}
                      {s.projectRef ? ` (${s.projectRef})` : ""}
                    </p>
                    {s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
