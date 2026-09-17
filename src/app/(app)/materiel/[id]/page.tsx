import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { getEquipment, EQUIPMENT_STATUS_LABELS } from "@/modules/equipment";
import { deleteEquipmentAction } from "@/modules/equipment/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { euros, dateFr } from "@/lib/format";

export default async function EquipmentDetailPage({ params }: PageProps<"/materiel/[id]"> ) {
  await requirePermission("equipment.view");
  const user = await getSessionUser();
  const { id } = await params;
  const e = await getEquipment(id);
  if (!e) notFound();
  const canEdit = user ? userCan(user, "equipment.edit") : false;
  const canDelete = user ? userCan(user, "equipment.delete") : false;

  return (
    <>
      <PageHeader
        title={e.name}
        description={e.reference ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={e.status === "available" ? "success" : e.status === "maintenance" ? "warning" : "neutral"}>{EQUIPMENT_STATUS_LABELS[e.status]}</Badge>
            {canEdit && <Link href={`/materiel/${id}/modifier`}><Button variant="secondary"><Pencil /> Modifier</Button></Link>}
            {canDelete && (
              <form action={deleteEquipmentAction.bind(null, id)}><Button type="submit" variant="secondary" size="sm">Supprimer</Button></form>
            )}
          </div>
        }
      />
      <Card>
        <CardHeader><CardTitle>Détails</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Catégorie">{e.category ?? "—"}</Info>
          <Info label="Quantité">{e.quantity}</Info>
          <Info label="État">{e.condition ?? "—"}</Info>
          <Info label="Localisation">{e.location ?? "—"}</Info>
          <Info label="Valeur">{e.value_cents != null ? euros(e.value_cents) : "—"}</Info>
          <Info label="Date d'achat">{e.purchase_date ? dateFr(e.purchase_date) : "—"}</Info>
          {e.notes && <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap">{e.notes}</p></div>}
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}
