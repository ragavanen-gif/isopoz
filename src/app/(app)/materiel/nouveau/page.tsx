import { requirePermission } from "@/core/auth/session";
import { createEquipmentAction } from "@/modules/equipment/actions";
import { EquipmentForm } from "@/modules/equipment/equipment-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewEquipmentPage() {
  await requirePermission("equipment.create");
  return (
    <>
      <PageHeader title="Nouveau matériel" description="Ajouter une référence au catalogue." />
      <EquipmentForm action={createEquipmentAction} submitLabel="Créer" />
    </>
  );
}
