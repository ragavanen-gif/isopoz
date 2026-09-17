"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTeamAction } from "./actions";

export function TeamCreateForm() {
  const [state, formAction, pending] = useActionState(createTeamAction, null);
  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <label className="text-sm font-medium" htmlFor="name">Nom de l'équipe</label>
        <Input id="name" name="name" required placeholder="Ex : Équipe A" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "…" : "Créer"}</Button>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
