import { requirePermission } from "@/core/auth/session";
import { listLeads } from "@/modules/site/admin-queries";
import { setLeadStatusAction } from "@/modules/site/admin-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { euros, dateTimeFr } from "@/lib/format";

export default async function AdminLeadsPage() {
  await requirePermission("admin.settings");
  const leads = await listLeads();

  return (
    <>
      <PageHeader title="Demandes reçues" description="Messages de contact et demandes du simulateur." />
      {leads.length === 0 ? (
        <EmptyState message="Aucune demande reçue." />
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <Card key={l.id}>
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {l.name ?? "—"}
                      <Badge tone={l.source === "simulator" ? "primary" : "info"} className="ml-2">{l.source === "simulator" ? "Simulateur" : "Contact"}</Badge>
                      {l.status !== "new" && <Badge tone="neutral" className="ml-1">{l.status === "handled" ? "Traité" : "Archivé"}</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">{l.email ?? ""}{l.phone ? ` · ${l.phone}` : ""}</p>
                    {l.estimate_cents != null && <p className="mt-1 text-sm font-medium text-primary">Estimation : {euros(l.estimate_cents)}</p>}
                    {l.message && <p className="mt-2 whitespace-pre-wrap text-sm">{l.message}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">{dateTimeFr(l.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    {l.status !== "handled" && <form action={setLeadStatusAction.bind(null, l.id, "handled")}><Button type="submit" variant="secondary" size="sm">Marquer traité</Button></form>}
                    {l.status !== "archived" && <form action={setLeadStatusAction.bind(null, l.id, "archived")}><Button type="submit" variant="ghost" size="sm">Archiver</Button></form>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
