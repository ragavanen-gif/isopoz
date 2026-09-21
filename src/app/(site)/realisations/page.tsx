import { listPublishedRealisations, siteMediaUrl } from "@/modules/site/queries";

export const metadata = { title: "Nos réalisations — ISOPoz" };

export default async function RealisationsPage() {
  const realisations = await listPublishedRealisations();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold">Nos réalisations</h1>
      <p className="mt-2 text-muted-foreground">Quelques exemples de chantiers menés par nos équipes.</p>

      {realisations.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">Nos réalisations seront bientôt présentées ici.</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {realisations.map((r) => {
            const img = siteMediaUrl(r.image_path);
            return (
              <article key={r.id} className="overflow-hidden rounded-[var(--radius-app)] border border-border bg-surface">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={r.title} className="h-48 w-full object-cover" />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-muted text-muted-foreground">Photo à venir</div>
                )}
                <div className="p-5">
                  <h2 className="font-semibold">{r.title}</h2>
                  {r.location && <p className="text-xs text-muted-foreground">{r.location}</p>}
                  {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
