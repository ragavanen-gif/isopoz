import { notFound } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { getRequest, getFormOptions } from "@/modules/requests/queries";
import { updateRequestAction } from "@/modules/requests/actions";
import { RequestForm } from "@/modules/requests/request-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function EditRequestPage({ params }: PageProps<"/demandes/[id]/modifier"> ) {
  await requirePermission("requests.edit");
  const { id } = await params;
  const [req, { clients, managers }] = await Promise.all([getRequest(id), getFormOptions()]);
  if (!req) notFound();
  const action = updateRequestAction.bind(null, id);

  return (
    <>
      <PageHeader title="Modifier la demande" description={req.reference ?? undefined} />
      <RequestForm action={action} request={req} clients={clients} managers={managers} submitLabel="Enregistrer" />
    </>
  );
}
