import Link from "next/link";
import { MapPin } from "lucide-react";
import { listPublishedRealisations, siteMediaUrl } from "@/modules/site/queries";
import { HexEmblem, VisualPanel } from "@/modules/site/decor";

export const metadata = { title: "Nos réalisations — ISOPoz" };

const PLACEHOLDERS = [
  { title: "Flocage coupe-feu — parking souterrain", location: "Chantier tertiaire" },
  { title: "Calorifugeage réseau de chaufferie", location: "Site industriel" },
  { title: "Isolation thermo-acoustique de plafonds", location: "Bâtiment public" },
];

export default async function RealisationsPage() {
  const realisations = await listPublishedRealisations();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">Nos réalisations</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Découvrez quelques exemples de chantiers de flocage et de calorifugeage menés par nos équipes,
        pour des professionnels, industriels et collectivités.
      </p>

      {realisations.length === 0 ? (
        <>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLACEHOLDERS.map((p) => (
              <article key={p.title} className="overflow-hidden rounded-[var(--radius-app)] border border-border bg-surface">
                <VisualPanel className="h-48"><HexEmblem className="mx-auto w-20 opacity-90" /></VisualPanel>
                <div className="p-5">
                  <h2 className="font-semibold">{p.title}</h2>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {p.location}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Nos photos de chantiers seront ajoutées prochainement.
          </p>
        </>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {realisations.map((r) => {
            const img = siteMediaUrl(r.image_path);
            return (
              <article key={r.id} className="overflow-hidden rounded-[var(--radius-app)] border border-border bg-surface">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={r.title} className="h-48 w-full object-cover" />
                ) : <VisualPanel className="h-48"><HexEmblem className="mx-auto w-20 opacity-90" /></VisualPanel>}
                <div className="p-5">
                  <h2 className="font-semibold">{r.title}</h2>
                  {r.location && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {r.location}</p>}
                  {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link href="/contact" className="inline-block rounded-[var(--radius-app)] bg-accent px-6 py-3 font-medium text-accent-foreground hover:bg-accent/90">
          Demandez votre devis gratuit
        </Link>
      </div>
    </div>
  );
}
