import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getClient, getClientContacts, getClientDashboard } from "@/modules/clients/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { euros } from "@/lib/format";
import { DeleteClientButton } from "./delete-button";
import { listDocuments } from "@/modules/documents/queries";
import { docTypeLabel } from "@/modules/documents/constants";
import { UploadForm } from "@/modules/documents/upload-form";
import { Download } from "lucide-react";

export default async function ClientDetailPage({ params }: PageProps<"/clients/[id]">) {
  await requirePermission("clients.view");
  const user = await getSessionUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const canViewDocs = user ? userCan(user, "documents.view") : false;
  const [contacts, dash, documents] = await Promise.all([
    getClientContacts(id),
    getClientDashboard(id),
    canViewDocs ? listDocuments(id) : Promise.resolve([]),
  ]);
  const canEdit = user ? userCan(user, "clients.edit") : false;
  const canDelete = user ? userCan(user, "clients.delete") : false;
  const canUploadDocs = user ? userCan(user, "documents.upload") : false;
  const canDownloadDocs = user ? userCan(user, "documents.download") : false;

  const kpi = (v: number | null) => (v == null ? "—" : euros(v));

  return (
    <>
      <PageHeader
        title={client.name}
        description={client.reference ?? undefined}
        actions={
          <div className="flex gap-2">
            {canEdit && (
              <Link href={`/clients/${id}/modifier`}>
                <Button variant="secondary">
                  <Pencil /> Modifier
                </Button>
              </Link>
            )}
            {canDelete && <DeleteClientButton clientId={id} />}
          </div>
        }
      />

      {/* Dashboard client (CDC §9) */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="CA facturé" value={kpi(dash.caTotal)} />
        <StatCard label="En attente" value={kpi(dash.invoicesPending)} tone="warning" />
        <StatCard label="En retard" value={kpi(dash.invoicesOverdue)} tone={dash.invoicesOverdue ? "danger" : "default"} />
        <StatCard label="Chantiers / Devis" value={`${dash.projectsCount} / ${dash.quotesCount}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Info label="Type">
              <Badge tone={client.type === "pro" ? "info" : "neutral"}>
                {client.type === "pro" ? "Professionnel" : "Particulier"}
              </Badge>
            </Info>
            <Info label="Email">{client.email ?? "—"}</Info>
            <Info label="Téléphone">{client.phone ?? "—"}</Info>
            <Info label="Site internet">{client.website ?? "—"}</Info>
            <Info label="Adresse">
              {[client.address, client.postal_code, client.city, client.country]
                .filter(Boolean)
                .join(", ") || "—"}
            </Info>
            <Info label="SIRET">{client.siret ?? "—"}</Info>
            <Info label="N° TVA">{client.vat_number ?? "—"}</Info>
            {client.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contacts.length === 0 ? (
              <p className="text-muted-foreground">Aucun contact.</p>
            ) : (
              contacts.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">
                    {c.name} {c.is_primary && <Badge tone="primary">Principal</Badge>}
                  </p>
                  {c.role && <p className="text-muted-foreground">{c.role}</p>}
                  {c.email && <p>{c.email}</p>}
                  {c.phone && <p>{c.phone}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {canViewDocs && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canUploadDocs && <UploadForm clients={[]} fixedClientId={id} />}
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun document classé pour ce client.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium">{d.name}</span>{" "}
                      <span className="text-muted-foreground">· {d.year} · {docTypeLabel(d.doc_type)}</span>
                    </span>
                    {canDownloadDocs && d.storage_path && (
                      <Link href={`/api/documents/${d.id}/download`} prefetch={false} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Download className="size-4" /> Télécharger
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
