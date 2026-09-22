import { requirePermission } from "@/core/auth/session";
import { listAllRealisations } from "@/modules/site/admin-queries";
import { siteMediaUrl } from "@/modules/site/queries";
import { deleteRealisationAction } from "@/modules/site/admin-actions";
import { RealisationForm } from "@/modules/site/realisation-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function AdminRealisationsPage() {
  await requirePermission("admin.settings");
  const items = await listAllRealisations();

  return (
    <>
      <PageHeader title="Réalisations" description="Ajoutez, modifiez et gérez les chantiers présentés sur le site (avec photos)." />

      <Card className="mb-6">
        <CardHeader><CardTitle>Nouvelle réalisation</CardTitle></CardHeader>
        <CardContent><RealisationForm /></CardContent>
      </Card>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune réalisation pour le moment.</p>
      ) : (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Réalisations existantes ({items.length})</h2>
          <div className="space-y-4">
            {items.map((r) => {
              const img = siteMediaUrl(r.image_path);
              return (
                <Card key={r.id}>
                  <CardContent className="pt-5">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="sm:w-56 shrink-0">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={r.title} className="h-36 w-full rounded-[var(--radius-app)] border border-border object-cover" />
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center rounded-[var(--radius-app)] border border-dashed border-border bg-muted text-xs text-muted-foreground">Sans photo</div>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-medium">{r.title}</span>
                          {!r.published && <Badge tone="neutral">Masqué</Badge>}
                        </div>
                      </div>

                      <details className="flex-1">
                        <summary className="cursor-pointer text-sm font-medium text-primary">Modifier cette réalisation</summary>
                        <div className="mt-3">
                          <RealisationForm realisation={r} />
                          <form action={deleteRealisationAction.bind(null, r.id)} className="mt-3 border-t border-border pt-3">
                            <Button type="submit" variant="ghost" size="sm">Supprimer définitivement</Button>
                          </form>
                        </div>
                      </details>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
