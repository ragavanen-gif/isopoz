import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listRequests } from "@/modules/requests/queries";
import { REQUEST_STATUS_LABELS } from "@/modules/requests/schema";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { dateFr } from "@/lib/format";

export default async function DemandesPage({ searchParams }: PageProps<"/demandes">) {
  await requirePermission("requests.view");
  const user = await getSessionUser();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const requests = await listRequests(status);
  const canCreate = user ? userCan(user, "requests.create") : false;

  return (
    <>
      <PageHeader
        title="Demandes clients"
        description={`${requests.length} demande(s)`}
        actions={
          canCreate && (
            <Link href="/demandes/nouveau">
              <Button><Plus /> Nouvelle demande</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/demandes" className={!status ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>Toutes</Link>
        {Object.entries(REQUEST_STATUS_LABELS).map(([key, label]) => (
          <Link key={key} href={`/demandes?status=${key}`} className={status === key ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}>
            {label}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState message="Aucune demande." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH><TH>Client</TH><TH>Objet</TH><TH>Reçue le</TH><TH>Gestionnaire</TH><TH>Statut</TH>
            </TR>
          </THead>
          <TBody>
            {requests.map((r) => (
              <TR key={r.id}>
                <TD className="font-mono text-xs text-muted-foreground">{r.reference ?? "—"}</TD>
                <TD>{r.client?.name ?? "—"}</TD>
                <TD>
                  <Link href={`/demandes/${r.id}`} className="font-medium text-primary hover:underline">{r.subject}</Link>
                </TD>
                <TD className="whitespace-nowrap">{dateFr(r.received_at)}</TD>
                <TD>{r.manager?.full_name ?? "—"}</TD>
                <TD><StatusBadge status={r.status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
