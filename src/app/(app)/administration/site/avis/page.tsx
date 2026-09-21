import { requirePermission } from "@/core/auth/session";
import { listAllReviews } from "@/modules/site/admin-queries";
import { saveReviewAction, deleteReviewAction } from "@/modules/site/admin-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function ReviewFields({ r }: { r?: { author_name: string; author_role: string | null; rating: number; content: string; published: boolean; position: number } }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Auteur" htmlFor="author_name"><Input name="author_name" defaultValue={r?.author_name} required /></Field>
      <Field label="Rôle / qualité" htmlFor="author_role"><Input name="author_role" defaultValue={r?.author_role ?? ""} placeholder="Particulier, Gérant…" /></Field>
      <Field label="Note (1-5)" htmlFor="rating"><Select name="rating" defaultValue={String(r?.rating ?? 5)}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} ★</option>)}</Select></Field>
      <Field label="Position" htmlFor="position"><Input name="position" type="number" defaultValue={r?.position ?? 0} /></Field>
      <Field label="Avis" htmlFor="content" className="sm:col-span-2"><Textarea name="content" defaultValue={r?.content} required /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="published" defaultChecked={r?.published ?? true} className="size-4" /> Publié</label>
    </div>
  );
}

export default async function AdminReviewsPage() {
  await requirePermission("admin.settings");
  const reviews = await listAllReviews();

  return (
    <>
      <PageHeader title="Avis clients" description="Ajoutez et gérez les témoignages affichés sur le site." />

      <Card className="mb-6">
        <CardHeader><CardTitle>Nouvel avis</CardTitle></CardHeader>
        <CardContent>
          <form action={saveReviewAction.bind(null, null)} className="space-y-3">
            <ReviewFields />
            <Button type="submit">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {reviews.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-5">
              <form action={saveReviewAction.bind(null, r.id)} className="space-y-3">
                <ReviewFields r={r} />
                <div className="flex gap-2">
                  <Button type="submit" variant="secondary">Enregistrer</Button>
                </div>
              </form>
              <form action={deleteReviewAction.bind(null, r.id)} className="mt-2">
                <Button type="submit" variant="ghost" size="sm">Supprimer</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
