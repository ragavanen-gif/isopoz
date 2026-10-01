"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { createEstimationProjectAction } from "./actions";

type R = { ok: true; id?: string } | { ok: false; error: string } | null;

export function ProjectCreateForm() {
  const [state, formAction, pending] = useActionState<R, FormData>(createEstimationProjectAction, null);
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
      <Field label="Nom du projet / chantier" htmlFor="name"><Input id="name" name="name" required placeholder="Ex : Collège A — R+2" /></Field>
      <Field label="Plan PDF" htmlFor="plan" hint="PDF (idéalement vectoriel), max 40 Mo"><Input id="plan" name="plan" type="file" accept=".pdf,application/pdf" required /></Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Import…" : "Créer le métré"}</Button>
      {state && !state.ok && <p className="text-sm text-danger sm:col-span-3">{state.error}</p>}
    </form>
  );
}
