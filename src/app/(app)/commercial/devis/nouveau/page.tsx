import { requirePermission } from "@/core/auth/session";
import { getFormOptions } from "@/modules/requests/queries";
import { createQuoteAction } from "@/modules/quotes/actions";
import { PageHeader } from "@/components/layout/page-header";
import { NewQuoteForm } from "@/modules/quotes/new-quote-form";

export default async function NewQuotePage() {
  await requirePermission("quotes.create");
  const { clients } = await getFormOptions();
  return (
    <>
      <PageHeader title="Nouveau devis" description="Choisir le client, puis ajouter les lignes." />
      <NewQuoteForm action={createQuoteAction} clients={clients} />
    </>
  );
}
