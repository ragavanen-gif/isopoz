"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { Supplier } from "./index";

type Result = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | null;

export function SupplierForm({
  action, supplier, submitLabel,
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>;
  supplier?: Supplier;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<Result, FormData>(action, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
          <Field label="Nom / raison sociale" htmlFor="name" required error={err.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={supplier?.name} required />
          </Field>
          <Field label="Contact" htmlFor="contact"><Input id="contact" name="contact" defaultValue={supplier?.contact ?? ""} /></Field>
          <Field label="Email" htmlFor="email" error={err.email}><Input id="email" name="email" type="email" defaultValue={supplier?.email ?? ""} /></Field>
          <Field label="Téléphone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={supplier?.phone ?? ""} /></Field>
          <Field label="Conditions de paiement" htmlFor="paymentTerms"><Input id="paymentTerms" name="paymentTerms" defaultValue={supplier?.payment_terms ?? ""} /></Field>
          <Field label="Adresse" htmlFor="address" className="sm:col-span-2"><Input id="address" name="address" defaultValue={supplier?.address ?? ""} /></Field>
          <Field label="SIRET" htmlFor="siret"><Input id="siret" name="siret" defaultValue={supplier?.siret ?? ""} /></Field>
          <Field label="N° TVA" htmlFor="vatNumber"><Input id="vatNumber" name="vatNumber" defaultValue={supplier?.vat_number ?? ""} /></Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" defaultValue={supplier?.notes ?? ""} /></Field>
        </CardContent>
      </Card>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</Button>
        <Link href={supplier ? `/achats/fournisseurs/${supplier.id}` : "/achats/fournisseurs"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
      </div>
    </form>
  );
}
