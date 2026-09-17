import Link from "next/link";
import { Download } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listDocuments } from "@/modules/documents/queries";
import { docTypeLabel } from "@/modules/documents/constants";
import { UploadForm } from "@/modules/documents/upload-form";
import { getFormOptions } from "@/modules/requests/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dateFr, euros } from "@/lib/format";

export default async function DocumentsPage() {
  await requirePermission("documents.view");
  const user = await getSessionUser();
  const [docs, { clients }] = await Promise.all([listDocuments(), getFormOptions()]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const canUpload = user ? userCan(user, "documents.upload") : false;
  const canDownload = user ? userCan(user, "documents.download") : false;

  return (
    <>
      <PageHeader title="Documents" description="Classement automatique Client → Année → Type." />

      {canUpload && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Téléverser un document</CardTitle></CardHeader>
          <CardContent><UploadForm clients={clients} /></CardContent>
        </Card>
      )}

      {docs.length === 0 ? (
        <EmptyState message="Aucun document." />
      ) : (
        <Table>
          <THead>
            <TR><TH>Document</TH><TH>Client</TH><TH>Année</TH><TH>Type</TH><TH>Date</TH><TH className="text-right">Montant</TH><TH></TH></TR>
          </THead>
          <TBody>
            {docs.map((d) => (
              <TR key={d.id}>
                <TD className="font-medium">{d.name}</TD>
                <TD>{d.client_id ? (clientName.get(d.client_id) ?? "—") : "—"}</TD>
                <TD>{d.year}</TD>
                <TD><Badge>{docTypeLabel(d.doc_type)}</Badge></TD>
                <TD className="whitespace-nowrap">{dateFr(d.ref_date)}</TD>
                <TD className="text-right tabular-nums">{d.amount_cents != null ? euros(d.amount_cents) : "—"}</TD>
                <TD className="text-right">
                  {canDownload && d.storage_path && (
                    <Link href={`/api/documents/${d.id}/download`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline" prefetch={false}>
                      <Download className="size-4" /> Télécharger
                    </Link>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
