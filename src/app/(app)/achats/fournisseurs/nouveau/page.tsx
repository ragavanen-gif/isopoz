import { requirePermission } from "@/core/auth/session";
import { createSupplierAction } from "@/modules/suppliers/actions";
import { SupplierForm } from "@/modules/suppliers/supplier-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewSupplierPage() {
  await requirePermission("suppliers.create");
  return (
    <>
      <PageHeader title="Nouveau fournisseur" description="Créer une fiche fournisseur." />
      <SupplierForm action={createSupplierAction} submitLabel="Créer" />
    </>
  );
}
