import { requirePermission } from "@/core/auth/session";
import { listAllRealisations } from "@/modules/site/admin-queries";
import { siteMediaUrl } from "@/modules/site/queries";
import { deleteRealisationAction } from "@/modules/site/admin-actions";
import { RealisationAddForm } from "@/modules/site/realisation-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function AdminRealisationsPage() {
  await requirePermission("admin.settings");
  const items = await listAllRealisations();

  return (
    <>
      <PageHeader title="Réalisations" description="Photos et descriptions de vos chantiers présentés sur le site." />

      <Card className="mb-6">
        <CardHeader><CardTitle>Nouvelle réalisation</CardTitle></CardHeader>
        <CardContent><RealisationAddForm /></CardContent>
      </Card>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune réalisation.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => {
            const img = siteMediaUrl(r.image_path);
            return (
              <Card key={r.id} className="overflow-hidden">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={r.title} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-muted text-xs text-muted-foreground">Sans photo</div>
                )}
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{r.title}</p>
                    {!r.published && <Badge tone="neutral">Masqué</Badge>}
                  </div>
                  {r.location && <p className="text-xs text-muted-foreground">{r.location}</p>}
                  <form action={deleteRealisationAction.bind(null, r.id)} className="mt-3">
                    <Button type="submit" variant="ghost" size="sm">Supprimer</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
