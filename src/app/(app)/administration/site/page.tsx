import Link from "next/link";
import { requirePermission } from "@/core/auth/session";
import { getSettingsAdmin } from "@/modules/site/admin-queries";
import { updateSiteSettingsAction } from "@/modules/site/admin-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function SiteAdminPage() {
  await requirePermission("admin.settings");
  const s = await getSettingsAdmin();

  return (
    <>
      <PageHeader
        title="Site internet"
        description="Contenu de votre site vitrine public."
        actions={<Link href="/" target="_blank"><Button variant="secondary" size="sm">Voir le site ↗</Button></Link>}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/administration/site/avis"><Button variant="secondary" size="sm">Avis clients</Button></Link>
        <Link href="/administration/site/realisations"><Button variant="secondary" size="sm">Réalisations</Button></Link>
        <Link href="/administration/site/simulateur"><Button variant="secondary" size="sm">Simulateur</Button></Link>
        <Link href="/administration/site/leads"><Button variant="secondary" size="sm">Demandes reçues</Button></Link>
      </div>

      <form action={updateSiteSettingsAction}>
        <Card className="mb-4">
          <CardHeader><CardTitle>Général</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nom de l'entreprise" htmlFor="company_name"><Input id="company_name" name="company_name" defaultValue={s.company_name} /></Field>
            <Field label="Slogan" htmlFor="tagline"><Input id="tagline" name="tagline" defaultValue={s.tagline} /></Field>
            <Field label="Email de contact" htmlFor="email"><Input id="email" name="email" defaultValue={s.email ?? ""} /></Field>
            <Field label="Téléphone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={s.phone ?? ""} /></Field>
            <Field label="Adresse" htmlFor="address" className="sm:col-span-2"><Input id="address" name="address" defaultValue={s.address ?? ""} /></Field>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader><CardTitle>Page d'accueil</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <Field label="Titre principal (hero)" htmlFor="hero_title"><Input id="hero_title" name="hero_title" defaultValue={s.hero_title} /></Field>
            <Field label="Sous-titre" htmlFor="hero_subtitle"><Input id="hero_subtitle" name="hero_subtitle" defaultValue={s.hero_subtitle} /></Field>
            <Field label="Texte du bouton d'appel (CTA)" htmlFor="cta_text"><Input id="cta_text" name="cta_text" defaultValue={s.cta_text} /></Field>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader><CardTitle>À propos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <Field label="Titre" htmlFor="about_title"><Input id="about_title" name="about_title" defaultValue={s.about_title} /></Field>
            <Field label="Texte" htmlFor="about_text"><Textarea id="about_text" name="about_text" defaultValue={s.about_text} className="min-h-40" /></Field>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader><CardTitle>Simulateur</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="simulator_enabled" defaultChecked={s.simulator_enabled} className="size-4" />
              Afficher le simulateur sur la page d'accueil
            </label>
            <Field label="Titre du simulateur" htmlFor="simulator_title"><Input id="simulator_title" name="simulator_title" defaultValue={s.simulator_title} /></Field>
            <p className="text-xs text-muted-foreground">Les prestations et tarifs se gèrent dans « Simulateur ».</p>
          </CardContent>
        </Card>

        <Button type="submit">Enregistrer le contenu</Button>
      </form>
    </>
  );
}
