import { requirePermission } from "@/core/auth/session";
import { listPrestations, type Prestation } from "@/modules/tools/queries";
import { savePrestationAction, deletePrestationAction } from "@/modules/tools/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { euros } from "@/lib/format";

function Fields({ p }: { p?: Prestation }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Nom" htmlFor="name" className="sm:col-span-2"><Input name="name" defaultValue={p?.name} required placeholder="Calorifuge tuyauterie DN20" /></Field>
      <Field label="Famille" htmlFor="family">
        <Select name="family" defaultValue={p?.family ?? "hydraulique"}>
          <option value="hydraulique">Hydraulique</option><option value="aeraulique">Aéraulique</option><option value="autre">Autre</option>
        </Select>
      </Field>
      <Field label="Type de réseau" htmlFor="networkType"><Input name="networkType" defaultValue={p?.network_type ?? ""} placeholder="ECT1-A, soufflage…" /></Field>
      <Field label="Dimension" htmlFor="dimension"><Input name="dimension" defaultValue={p?.dimension ?? ""} placeholder="DN20, Ø160, 550x300" /></Field>
      <Field label="Épaisseur isolant" htmlFor="thickness"><Input name="thickness" defaultValue={p?.thickness ?? ""} placeholder="25 mm" /></Field>
      <Field label="Matériau" htmlFor="material"><Input name="material" defaultValue={p?.material ?? ""} placeholder="Laine de verre, coquille…" /></Field>
      <Field label="Classe d'isolation" htmlFor="insulationClass"><Input name="insulationClass" defaultValue={p?.insulation_class ?? ""} placeholder="4/5" /></Field>
      <Field label="Finition" htmlFor="finish"><Input name="finish" defaultValue={p?.finish ?? ""} placeholder="PVC, tôle isoxale" /></Field>
      <Field label="Unité" htmlFor="unit">
        <Select name="unit" defaultValue={p?.unit ?? "ml"}>
          <option value="ml">ml</option><option value="m2">m²</option><option value="u">U</option><option value="forfait">Forfait</option>
        </Select>
      </Field>
      <Field label="Prix fourniture (€)" htmlFor="priceSupply"><Input name="priceSupply" inputMode="decimal" defaultValue={p ? (p.price_supply_cents / 100).toString() : ""} /></Field>
      <Field label="Prix pose (€)" htmlFor="priceInstall"><Input name="priceInstall" inputMode="decimal" defaultValue={p ? (p.price_install_cents / 100).toString() : ""} /></Field>
      <Field label="Marge / coeff. (%)" htmlFor="margin"><Input name="margin" inputMode="decimal" defaultValue={p ? (p.margin_bps / 100).toString() : "0"} /></Field>
    </div>
  );
}

export default async function PrestationsPage() {
  await requirePermission("tools.manage");
  const prestations = await listPrestations();

  const unitPrice = (p: Prestation) => Math.round((p.price_supply_cents + p.price_install_cents) * (1 + p.margin_bps / 10000));

  return (
    <>
      <PageHeader title="Bibliothèque de prestations" description="Prix 100 % personnalisables — rien n'est imposé par l'outil." />

      <Card className="mb-6">
        <CardHeader><CardTitle>Nouvelle prestation</CardTitle></CardHeader>
        <CardContent>
          <form action={savePrestationAction.bind(null, null)} className="space-y-3">
            <Fields />
            <Button type="submit">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      {prestations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune prestation. Créez-en pour chiffrer vos métrés.</p>
      ) : (
        <div className="space-y-3">
          {prestations.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-5">
                <details>
                  <summary className="flex cursor-pointer items-center justify-between">
                    <span className="font-medium">{p.name} <span className="text-sm text-muted-foreground">· {p.dimension ?? ""} · {p.unit}</span></span>
                    <span className="text-sm font-semibold text-primary">{euros(unitPrice(p))} / {p.unit}</span>
                  </summary>
                  <div className="mt-4">
                    <form action={savePrestationAction.bind(null, p.id)} className="space-y-3">
                      <Fields p={p} />
                      <Button type="submit" variant="secondary">Enregistrer</Button>
                    </form>
                    <form action={deletePrestationAction.bind(null, p.id)} className="mt-2">
                      <Button type="submit" variant="ghost" size="sm">Supprimer</Button>
                    </form>
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
