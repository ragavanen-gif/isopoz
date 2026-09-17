import { notFound } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { getEquipment } from "@/modules/equipment";
import { updateEquipmentAction } from "@/modules/equipment/actions";
import { EquipmentForm } from "@/modules/equipment/equipment-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function EditEquipmentPage({ params }: PageProps<"/materiel/[id]/modifier"> ) {
  await requirePermission("equipment.edit");
  const { id } = await params;
  const equipment = await getEquipment(id);
  if (!equipment) notFound();
  return (
    <>
      <PageHeader title="Modifier le matériel" description={equipment.name} />
      <EquipmentForm action={updateEquipmentAction.bind(null, id)} equipment={equipment} submitLabel="Enregistrer" />
    </>
  );
}
