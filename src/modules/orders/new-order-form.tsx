"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createOrderAction } from "./actions";

type Result = { ok: false; error: string } | null;

export function NewOrderForm({
  suppliers, projects,
}: {
  suppliers: { id: string; name: string }[];
  projects: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState<Result, FormData>(createOrderAction, null);
  return (
    <form action={formAction} className="max-w-xl space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <Field label="Fournisseur" htmlFor="supplierId" required>
            <Select id="supplierId" name="supplierId" required defaultValue="">
              <option value="" disabled>Sélectionner…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Chantier associé (optionnel)" htmlFor="projectId">
            <Select id="projectId" name="projectId" defaultValue="">
              <option value="">Aucun</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </Field>
        </CardContent>
      </Card>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer la commande"}</Button>
        <Link href="/achats/commandes"><Button type="button" variant="secondary">Annuler</Button></Link>
      </div>
    </form>
  );
}
