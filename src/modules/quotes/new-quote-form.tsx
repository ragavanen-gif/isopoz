"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Result = { ok: false; error: string } | null;

export function NewQuoteForm({
  action,
  clients,
}: {
  action: (prev: unknown, formData: FormData) => Promise<Result>;
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="max-w-xl space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <Field label="Client" htmlFor="clientId" required>
            <Select id="clientId" name="clientId" required defaultValue="">
              <option value="" disabled>Sélectionner…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Objet" htmlFor="subject">
            <Input id="subject" name="subject" placeholder="Objet du devis" />
          </Field>
        </CardContent>
      </Card>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer le devis"}</Button>
        <Link href="/commercial/devis"><Button type="button" variant="secondary">Annuler</Button></Link>
      </div>
    </form>
  );
}
