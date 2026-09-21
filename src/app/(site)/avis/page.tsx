import { Star } from "lucide-react";
import { listPublishedReviews } from "@/modules/site/queries";

export const metadata = { title: "Avis clients — ISOPoz" };

export default async function AvisPage() {
  const reviews = await listPublishedReviews();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">Avis clients</h1>
      <p className="mt-2 text-muted-foreground">La satisfaction de nos clients est notre priorité.</p>

      {reviews.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">Aucun avis pour le moment.</p>
      ) : (
        <div className="mt-10 space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-[var(--radius-app)] border border-border bg-surface p-6">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.author_name}{r.author_role ? <span className="text-muted-foreground"> · {r.author_role}</span> : null}</p>
                <div className="flex gap-0.5 text-warning">
                  {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
                </div>
              </div>
              <p className="mt-3 text-sm">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
