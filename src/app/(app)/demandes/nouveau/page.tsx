import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { getFormOptions } from "@/modules/requests/queries";
import { createRequestAction } from "@/modules/requests/actions";
import { RequestForm } from "@/modules/requests/request-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewRequestPage({ searchParams }: PageProps<"/demandes/nouveau">) {
  await requirePermission("requests.create");
  const { clients, managers } = await getFormOptions();
  const sp = await searchParams;
  // Pré-sélection du client si arrivée depuis une fiche client (?client=...).
  if (typeof sp.client === "string" && !clients.find((c) => c.id === sp.client)) {
    // client inconnu ou supprimé : on ignore.
  }

  return (
    <>
      <PageHeader title="Nouvelle demande" description="Enregistrer le besoin initial d'un client." />
      <RequestForm action={createRequestAction} clients={clients} managers={managers} submitLabel="Créer la demande" />
    </>
  );
}
