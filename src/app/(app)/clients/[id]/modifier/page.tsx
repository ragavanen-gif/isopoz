import { notFound } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { getClient } from "@/modules/clients/queries";
import { updateClientAction } from "@/modules/clients/actions";
import { ClientForm } from "@/modules/clients/client-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/modifier">) {
  await requirePermission("clients.edit");
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const action = updateClientAction.bind(null, id);

  return (
    <>
      <PageHeader title="Modifier le client" description={client.name} />
      <ClientForm action={action} client={client} submitLabel="Enregistrer" />
    </>
  );
}
