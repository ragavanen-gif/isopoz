"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { Client } from "./schema";

type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

export function ClientForm({
  action,
  client,
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  client?: Client;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
          <Field label="Nom / raison sociale" htmlFor="name" required error={err.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={client?.name} required />
          </Field>
          <Field label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue={client?.type ?? "pro"}>
              <option value="pro">Professionnel</option>
              <option value="particulier">Particulier</option>
            </Select>
          </Field>
          <Field label="Email" htmlFor="email" error={err.email}>
            <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
          </Field>
          <Field label="Téléphone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
          </Field>
          <Field label="Site internet" htmlFor="website">
            <Input id="website" name="website" defaultValue={client?.website ?? ""} />
          </Field>
          <Field label="Adresse" htmlFor="address" className="sm:col-span-2">
            <Input id="address" name="address" defaultValue={client?.address ?? ""} />
          </Field>
          <Field label="Code postal" htmlFor="postalCode">
            <Input id="postalCode" name="postalCode" defaultValue={client?.postal_code ?? ""} />
          </Field>
          <Field label="Ville" htmlFor="city">
            <Input id="city" name="city" defaultValue={client?.city ?? ""} />
          </Field>
          <Field label="Pays" htmlFor="country">
            <Input id="country" name="country" defaultValue={client?.country ?? "France"} />
          </Field>
          <Field label="SIRET" htmlFor="siret">
            <Input id="siret" name="siret" defaultValue={client?.siret ?? ""} />
          </Field>
          <Field label="N° TVA" htmlFor="vatNumber">
            <Input id="vatNumber" name="vatNumber" defaultValue={client?.vat_number ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>

      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
        <Link href={client ? `/clients/${client.id}` : "/clients"}>
          <Button type="button" variant="secondary">
            Annuler
          </Button>
        </Link>
      </div>
    </form>
  );
}
