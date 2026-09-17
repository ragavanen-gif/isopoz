import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listEquipment, EQUIPMENT_STATUS_LABELS } from "@/modules/equipment";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function MaterielPage() {
  await requirePermission("equipment.view");
  const user = await getSessionUser();
  const equipment = await listEquipment();
  const canCreate = user ? userCan(user, "equipment.create") : false;

  return (
    <>
      <PageHeader
        title="Matériel"
        description={`${equipment.length} référence(s)`}
        actions={canCreate && (
          <Link href="/materiel/nouveau"><Button><Plus /> Nouveau matériel</Button></Link>
        )}
      />
      {equipment.length === 0 ? (
        <EmptyState message="Aucun matériel." />
      ) : (
        <Table>
          <THead><TR><TH>Nom</TH><TH>Référence</TH><TH>Catégorie</TH><TH className="text-right">Qté</TH><TH>Localisation</TH><TH>Disponibilité</TH></TR></THead>
          <TBody>
            {equipment.map((e) => (
              <TR key={e.id}>
                <TD>
                  <Link href={`/materiel/${e.id}`} className="font-medium text-primary hover:underline">{e.name}</Link>
                </TD>
                <TD className="font-mono text-xs text-muted-foreground">{e.reference ?? "—"}</TD>
                <TD>{e.category ?? "—"}</TD>
                <TD className="text-right tabular-nums">{e.quantity}</TD>
                <TD>{e.location ?? "—"}</TD>
                <TD>
                  <Badge tone={e.status === "available" ? "success" : e.status === "maintenance" ? "warning" : "neutral"}>
                    {EQUIPMENT_STATUS_LABELS[e.status]}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
