"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <Field label="Nom complet" htmlFor="fullName">
        <Input id="fullName" name="fullName" required />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required />
      </Field>
      <Field label="Mot de passe" htmlFor="password" hint="8 caractères min.">
        <Input id="password" name="password" type="password" required minLength={8} />
      </Field>
      <div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Création…" : "Créer l'utilisateur"}
        </Button>
      </div>
      {state && !state.ok && <p className="text-sm text-danger sm:col-span-4">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success sm:col-span-4">Utilisateur créé.</p>}
    </form>
  );
}
