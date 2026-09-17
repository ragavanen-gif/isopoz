"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { CustomerRequest } from "./schema";

type Result = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | null;

export function RequestForm({
  action,
  request,
  clients,
  managers,
  submitLabel,
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>;
  request?: CustomerRequest;
  clients: { id: string; name: string }[];
  managers: { id: string; full_name: string | null; email: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<Result, FormData>(action, null);
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
          <Field label="Client" htmlFor="clientId" required error={err.clientId}>
            <Select id="clientId" name="clientId" defaultValue={request?.client_id ?? ""} required>
              <option value="" disabled>Sélectionner…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date de réception" htmlFor="receivedAt">
            <Input id="receivedAt" name="receivedAt" type="date" defaultValue={request?.received_at ?? new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Objet" htmlFor="subject" required error={err.subject} className="sm:col-span-2">
            <Input id="subject" name="subject" defaultValue={request?.subject ?? ""} required />
          </Field>
          <Field label="Gestionnaire responsable" htmlFor="managerId">
            <Select id="managerId" name="managerId" defaultValue={request?.manager_id ?? ""}>
              <option value="">Non assigné</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" name="description" defaultValue={request?.description ?? ""} className="min-h-32" />
          </Field>
        </CardContent>
      </Card>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</Button>
        <Link href={request ? `/demandes/${request.id}` : "/demandes"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
      </div>
    </form>
  );
}
