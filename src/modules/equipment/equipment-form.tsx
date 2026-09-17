"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { Equipment } from "./index";

type Result = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | null;

export function EquipmentForm({
  action,
  equipment,
  submitLabel,
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>;
  equipment?: Equipment;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<Result, FormData>(action, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
          <Field label="Nom" htmlFor="name" required error={err.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={equipment?.name} required />
          </Field>
          <Field label="Référence" htmlFor="reference">
            <Input id="reference" name="reference" defaultValue={equipment?.reference ?? ""} />
          </Field>
          <Field label="Catégorie" htmlFor="category">
            <Input id="category" name="category" defaultValue={equipment?.category ?? ""} />
          </Field>
          <Field label="Quantité" htmlFor="quantity">
            <Input id="quantity" name="quantity" type="number" min={0} defaultValue={equipment?.quantity ?? 1} />
          </Field>
          <Field label="État" htmlFor="condition">
            <Input id="condition" name="condition" defaultValue={equipment?.condition ?? ""} />
          </Field>
          <Field label="Localisation" htmlFor="location">
            <Input id="location" name="location" defaultValue={equipment?.location ?? ""} />
          </Field>
          <Field label="Disponibilité" htmlFor="status">
            <Select id="status" name="status" defaultValue={equipment?.status ?? "available"}>
              <option value="available">Disponible</option>
              <option value="maintenance">En maintenance</option>
              <option value="retired">Retiré</option>
            </Select>
          </Field>
          <Field label="Valeur (€)" htmlFor="value">
            <Input id="value" name="value" inputMode="decimal" defaultValue={equipment?.value_cents != null ? (equipment.value_cents / 100).toString() : ""} />
          </Field>
          <Field label="Date d'achat" htmlFor="purchaseDate">
            <Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={equipment?.purchase_date ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={equipment?.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</Button>
        <Link href={equipment ? `/materiel/${equipment.id}` : "/materiel"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
      </div>
    </form>
  );
}
