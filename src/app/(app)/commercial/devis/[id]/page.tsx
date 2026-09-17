import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { createClient as createServerClient } from "@/core/supabase/server";
import { getQuote, getQuoteItems } from "@/modules/quotes/queries";
import {
  updateQuoteMetaAction, setQuoteStatusAction, deleteQuoteAction,
} from "@/modules/quotes/actions";
import {
  QUOTE_TRANSITIONS, QUOTE_STATUS_LABELS, QUOTE_EDITABLE_STATUSES,
} from "@/modules/quotes/schema";
import { QuoteItemsEditor } from "@/modules/quotes/quote-items-editor";
import { GenerateQuotePdfButton } from "@/modules/quotes/generate-pdf-button";
import { createProjectFromQuoteAction } from "@/modules/projects/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { dateFr } from "@/lib/format";

export default async function QuoteDetailPage({ params }: PageProps<"/commercial/devis/[id]"> ) {
  await requirePermission("quotes.view");
  const user = await getSessionUser();
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const [items, settings] = await Promise.all([
    getQuoteItems(id),
    (await createServerClient()).from("company_settings").select("default_vat_bps").eq("id", true).maybeSingle(),
  ]);
  const defaultVat = (settings.data?.default_vat_bps ?? 2000) / 100;

  const canEdit = user ? userCan(user, "quotes.edit") : false;
  const canDelete = user ? userCan(user, "quotes.delete") : false;
  const canGenerate = user ? userCan(user, "documents.upload") : false;
  const canCreateProject = user ? userCan(user, "projects.create") : false;
  const editable = canEdit && QUOTE_EDITABLE_STATUSES.includes(quote.status);
  const nextStatuses = QUOTE_TRANSITIONS[quote.status];
  const saveMeta = updateQuoteMetaAction.bind(null, id);

  return (
    <>
      <PageHeader
        title={quote.reference ?? "Devis"}
        description={quote.subject ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={quote.status} />
            {canDelete && (
              <form action={deleteQuoteAction.bind(null, id)}>
                <Button type="submit" variant="secondary" size="sm">Supprimer</Button>
              </form>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent>
            <form action={saveMeta} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Client">
                <div className="flex h-9 items-center px-1">
                  <Link href={`/clients/${quote.client_id}`} className="text-primary hover:underline">{quote.client?.name ?? "—"}</Link>
                </div>
              </Field>
              <Field label="Objet" htmlFor="subject">
                <Input id="subject" name="subject" defaultValue={quote.subject ?? ""} disabled={!editable} />
              </Field>
              <Field label="Date d'émission" htmlFor="issueDate">
                <Input id="issueDate" name="issueDate" type="date" defaultValue={quote.issue_date} disabled={!editable} />
              </Field>
              <Field label="Valide jusqu'au" htmlFor="validUntil">
                <Input id="validUntil" name="validUntil" type="date" defaultValue={quote.valid_until ?? ""} disabled={!editable} />
              </Field>
              <Field label="Conditions de paiement" htmlFor="paymentTerms" className="sm:col-span-2">
                <Input id="paymentTerms" name="paymentTerms" defaultValue={quote.payment_terms ?? ""} disabled={!editable} />
              </Field>
              <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
                <Textarea id="notes" name="notes" defaultValue={quote.notes ?? ""} disabled={!editable} />
              </Field>
              {editable && (
                <div className="sm:col-span-2">
                  <Button type="submit" variant="secondary">Enregistrer les informations</Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!editable && QUOTE_EDITABLE_STATUSES.includes(quote.status) === false && (
              <p className="text-xs text-muted-foreground">
                Devis verrouillé (statut « {QUOTE_STATUS_LABELS[quote.status]} »).
              </p>
            )}
            {canEdit && nextStatuses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((s) => (
                  <form key={s} action={setQuoteStatusAction.bind(null, id, s)}>
                    <Button type="submit" variant={s === "accepte" ? "primary" : "secondary"} size="sm">
                      {s === "envoye" ? "Envoyer" : s === "accepte" ? "Valider (accepté)" : QUOTE_STATUS_LABELS[s]}
                    </Button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune action disponible.</p>
            )}
            {quote.status === "accepte" && (
              <div className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">
                {quote.project_id ? (
                  <Link href={`/chantiers/${quote.project_id}`} className="font-medium underline">
                    Chantier créé — voir le chantier
                  </Link>
                ) : canCreateProject ? (
                  <form action={createProjectFromQuoteAction.bind(null, id)}>
                    <button type="submit" className="font-medium underline">
                      Devis accepté — créer le chantier
                    </button>
                  </form>
                ) : (
                  <span>Devis accepté.</span>
                )}
              </div>
            )}
            {canGenerate && (
              <div className="border-t border-border pt-3">
                <GenerateQuotePdfButton quoteId={id} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lignes du devis</CardTitle>
          <p className="text-xs text-muted-foreground">
            Émis le {dateFr(quote.issue_date)} · les totaux sont recalculés côté serveur.
          </p>
        </CardHeader>
        <CardContent>
          <QuoteItemsEditor quoteId={id} initialItems={items} editable={editable} defaultVat={defaultVat} />
        </CardContent>
      </Card>
    </>
  );
}
