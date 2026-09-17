import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, FileOutput } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getRequest, getRequestQuotes } from "@/modules/requests/queries";
import {
  setRequestStatusAction, convertRequestToQuoteAction,
} from "@/modules/requests/actions";
import { REQUEST_TRANSITIONS, REQUEST_STATUS_LABELS } from "@/modules/requests/schema";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dateFr, euros } from "@/lib/format";

export default async function RequestDetailPage({ params }: PageProps<"/demandes/[id]"> ) {
  await requirePermission("requests.view");
  const user = await getSessionUser();
  const { id } = await params;
  const req = await getRequest(id);
  if (!req) notFound();
  const quotes = await getRequestQuotes(id);

  const canEdit = user ? userCan(user, "requests.edit") : false;
  const canCreateQuote = user ? userCan(user, "quotes.create") : false;
  const nextStatuses = REQUEST_TRANSITIONS[req.status];

  return (
    <>
      <PageHeader
        title={req.subject}
        description={req.reference ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={req.status} />
            {canEdit && (
              <Link href={`/demandes/${id}/modifier`}>
                <Button variant="secondary"><Pencil /> Modifier</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Détails</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Info label="Client">
              <Link href={`/clients/${req.client_id}`} className="text-primary hover:underline">{req.client?.name ?? "—"}</Link>
            </Info>
            <Info label="Reçue le">{dateFr(req.received_at)}</Info>
            <Info label="Gestionnaire">{req.manager?.full_name ?? "Non assigné"}</Info>
            <Info label="Source">{req.source === "email" ? "Email" : "Saisie manuelle"}</Info>
            {req.description && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap">{req.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {canEdit && nextStatuses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Faire évoluer</p>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((s) => {
                    const act = setRequestStatusAction.bind(null, id, s);
                    return (
                      <form key={s} action={act}>
                        <Button type="submit" variant="secondary" size="sm">{REQUEST_STATUS_LABELS[s]}</Button>
                      </form>
                    );
                  })}
                </div>
              </div>
            )}
            {canCreateQuote && req.status !== "annulee" && req.status !== "refusee" && (
              <form action={convertRequestToQuoteAction.bind(null, id)}>
                <Button type="submit" className="w-full"><FileOutput /> Créer un devis</Button>
                <p className="mt-1 text-xs text-muted-foreground">Reprend automatiquement le client et l'objet.</p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Devis liés</CardTitle></CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun devis pour cette demande.</p>
          ) : (
            <Table>
              <THead><TR><TH>Référence</TH><TH>Date</TH><TH>Montant TTC</TH><TH>Statut</TH></TR></THead>
              <TBody>
                {quotes.map((q) => (
                  <TR key={q.id}>
                    <TD>
                      <Link href={`/commercial/devis/${q.id}`} className="font-mono text-xs text-primary hover:underline">{q.reference}</Link>
                    </TD>
                    <TD>{dateFr(q.issue_date)}</TD>
                    <TD className="tabular-nums">{euros(q.total_cents)}</TD>
                    <TD><StatusBadge status={q.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
