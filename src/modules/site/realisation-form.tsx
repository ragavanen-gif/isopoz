"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { saveRealisationAction } from "./admin-actions";

type Result = { ok: true } | { ok: false; error: string } | null;

export type RealisationValue = {
  id: string; title: string; description: string | null; location: string | null;
  published: boolean; position: number;
};

export function RealisationForm({ realisation }: { realisation?: RealisationValue }) {
  const isEdit = !!realisation;
  const action = saveRealisationAction.bind(null, realisation?.id ?? null);
  const [state, formAction, pending] = useActionState<Result, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && !isEdit) ref.current?.reset(); }, [state, isEdit]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Titre" htmlFor="title"><Input name="title" defaultValue={realisation?.title} required /></Field>
        <Field label="Lieu" htmlFor="location"><Input name="location" defaultValue={realisation?.location ?? ""} placeholder="Ville, département" /></Field>
        <Field label="Description" htmlFor="description" className="sm:col-span-2"><Textarea name="description" defaultValue={realisation?.description ?? ""} /></Field>
        <Field label={isEdit ? "Remplacer la photo (optionnel)" : "Photo"} htmlFor="image" hint="JPG/PNG/WebP, max 8 Mo" className="sm:col-span-2">
          <Input name="image" type="file" accept=".jpg,.jpeg,.png,.webp" />
        </Field>
        <Field label="Position (ordre d'affichage)" htmlFor="position"><Input name="position" type="number" defaultValue={realisation?.position ?? 0} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="published" defaultChecked={realisation?.published ?? true} className="size-4" /> Publié (visible sur le site)</label>
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success">{isEdit ? "Réalisation mise à jour." : "Réalisation ajoutée."}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Ajouter la réalisation"}</Button>
    </form>
  );
}
