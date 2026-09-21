import { notFound } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { getSupplier } from "@/modules/suppliers";
import { updateSupplierAction } from "@/modules/suppliers/actions";
import { SupplierForm } from "@/modules/suppliers/supplier-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function EditSupplierPage({ params }: PageProps<"/achats/fournisseurs/[id]/modifier"> ) {
  await requirePermission("suppliers.edit");
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  return (
    <>
      <PageHeader title="Modifier le fournisseur" description={supplier.name} />
      <SupplierForm action={updateSupplierAction.bind(null, id)} supplier={supplier} submitLabel="Enregistrer" />
    </>
  );
}
