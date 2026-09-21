import { requirePermission } from "@/core/auth/session";
import { listAllServices } from "@/modules/site/admin-queries";
import { saveServiceAction, deleteServiceAction } from "@/modules/site/admin-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function ServiceFields({ s }: { s?: { name: string; description: string | null; unit_label: string; unit_price_cents: number; active: boolean; position: number } }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Nom de la prestation" htmlFor="name"><Input name="name" defaultValue={s?.name} required /></Field>
      <Field label="Unité" htmlFor="unit_label"><Input name="unit_label" defaultValue={s?.unit_label ?? "m²"} /></Field>
      <Field label="Prix par unité (€)" htmlFor="unit_price"><Input name="unit_price" inputMode="decimal" defaultValue={s ? (s.unit_price_cents / 100).toString() : ""} required /></Field>
      <Field label="Position" htmlFor="position"><Input name="position" type="number" defaultValue={s?.position ?? 0} /></Field>
      <Field label="Description" htmlFor="description" className="sm:col-span-2"><Textarea name="description" defaultValue={s?.description ?? ""} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-4" /> Actif (visible dans le simulateur)</label>
    </div>
  );
}

export default async function AdminSimulatorPage() {
  await requirePermission("admin.settings");
  const services = await listAllServices();

  return (
    <>
      <PageHeader title="Simulateur — prestations" description="Configurez les prestations et tarifs proposés dans le simulateur du site." />

      <Card className="mb-6">
        <CardHeader><CardTitle>Nouvelle prestation</CardTitle></CardHeader>
        <CardContent>
          <form action={saveServiceAction.bind(null, null)} className="space-y-3">
            <ServiceFields />
            <Button type="submit">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {services.map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-5">
              <form action={saveServiceAction.bind(null, s.id)} className="space-y-3">
                <ServiceFields s={s} />
                <Button type="submit" variant="secondary">Enregistrer</Button>
              </form>
              <form action={deleteServiceAction.bind(null, s.id)} className="mt-2">
                <Button type="submit" variant="ghost" size="sm">Supprimer</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
