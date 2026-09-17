import { requirePermission } from "@/core/auth/session";
import { listAudit } from "@/modules/admin/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { dateTimeFr } from "@/lib/format";

export default async function JournalPage() {
  await requirePermission("admin.audit");
  const entries = await listAudit();

  return (
    <>
      <PageHeader title="Journal d'activité" description="Traçabilité des actions importantes." />
      {entries.length === 0 ? (
        <EmptyState message="Aucune action enregistrée." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Utilisateur</TH>
              <TH>Action</TH>
              <TH>Objet</TH>
            </TR>
          </THead>
          <TBody>
            {entries.map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap text-muted-foreground">{dateTimeFr(e.at)}</TD>
                <TD>{e.user?.full_name ?? e.user?.email ?? "Système"}</TD>
                <TD className="font-mono text-xs">{e.action}</TD>
                <TD className="text-muted-foreground">
                  {e.entity_type}
                  {e.entity_id ? ` · ${e.entity_id.slice(0, 8)}…` : ""}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
