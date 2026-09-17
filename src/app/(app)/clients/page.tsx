import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listClients } from "@/modules/clients/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  await requirePermission("clients.view");
  const user = await getSessionUser();
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const clients = await listClients(search);
  const canCreate = user ? userCan(user, "clients.create") : false;

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${clients.length} client${clients.length > 1 ? "s" : ""}`}
        actions={
          canCreate && (
            <Link href="/clients/nouveau">
              <Button>
                <Plus /> Nouveau client
              </Button>
            </Link>
          )
        }
      />

      <form className="mb-4 max-w-sm">
        <Input name="q" placeholder="Rechercher…" defaultValue={search ?? ""} />
      </form>

      {clients.length === 0 ? (
        <EmptyState message="Aucun client pour le moment." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Référence</TH>
              <TH>Nom</TH>
              <TH>Type</TH>
              <TH>Ville</TH>
              <TH>Email</TH>
              <TH>Téléphone</TH>
            </TR>
          </THead>
          <TBody>
            {clients.map((c) => (
              <TR key={c.id}>
                <TD className="font-mono text-xs text-muted-foreground">{c.reference ?? "—"}</TD>
                <TD>
                  <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.name}
                  </Link>
                </TD>
                <TD>
                  <Badge tone={c.type === "pro" ? "info" : "neutral"}>
                    {c.type === "pro" ? "Pro" : "Particulier"}
                  </Badge>
                </TD>
                <TD>{c.city ?? "—"}</TD>
                <TD>{c.email ?? "—"}</TD>
                <TD>{c.phone ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
