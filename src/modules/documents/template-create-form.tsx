"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { DOC_TYPES } from "./constants";
import { createTemplateAction } from "./actions";

export function TemplateCreateForm() {
  const [state, formAction, pending] = useActionState(createTemplateAction, null);
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <Field label="Nom du modèle" htmlFor="name">
        <Input id="name" name="name" required placeholder="Ex : Devis standard" />
      </Field>
      <Field label="Type" htmlFor="docType">
        <Select id="docType" name="docType" defaultValue="devis">
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Portée" htmlFor="scope">
        <Select id="scope" name="scope" defaultValue="company">
          <option value="company">Entreprise</option>
          <option value="personal">Personnel</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Création…" : "Créer le modèle"}
      </Button>
      {state && !state.ok && <p className="text-sm text-danger sm:col-span-4">{state.error}</p>}
    </form>
  );
}
