import { requirePermission } from "@/core/auth/session";
import { createClientAction } from "@/modules/clients/actions";
import { ClientForm } from "@/modules/clients/client-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewClientPage() {
  await requirePermission("clients.create");
  return (
    <>
      <PageHeader title="Nouveau client" description="Créer une fiche client." />
      <ClientForm action={createClientAction} submitLabel="Créer le client" />
    </>
  );
}
