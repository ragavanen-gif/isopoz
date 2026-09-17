"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadDocumentAction } from "./file-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { DOC_TYPES } from "./constants";

export function UploadForm({
  clients,
  fixedClientId,
}: {
  clients: { id: string; name: string }[];
  fixedClientId?: string;
}) {
  const [state, formAction, pending] = useActionState(uploadDocumentAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
      {fixedClientId ? (
        <input type="hidden" name="clientId" value={fixedClientId} />
      ) : (
        <Field label="Client" htmlFor="clientId">
          <Select id="clientId" name="clientId" required defaultValue="">
            <option value="" disabled>Sélectionner…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Type" htmlFor="docType">
        <Select id="docType" name="docType" defaultValue="autre">
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
          <option value="autre">Autre</option>
        </Select>
      </Field>
      <Field label="Nom (optionnel)" htmlFor="name">
        <Input id="name" name="name" placeholder="Nom du document" />
      </Field>
      <Field label="Fichier" htmlFor="file" hint="PDF, image, Word, Excel — max 10 Mo">
        <Input id="file" name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Envoi…" : "Téléverser"}
      </Button>
      {state && !state.ok && <p className="text-sm text-danger sm:col-span-5">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success sm:col-span-5">Document téléversé et classé.</p>}
    </form>
  );
}
