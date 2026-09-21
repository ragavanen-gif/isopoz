"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { submitContactAction } from "./public-actions";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactAction, null);

  if (state?.ok) {
    return (
      <div className="rounded-[var(--radius-app)] border border-border bg-surface p-8 text-center">
        <p className="text-lg font-semibold text-success">Message envoyé !</p>
        <p className="mt-2 text-sm text-muted-foreground">Merci, nous vous répondrons dans les meilleurs délais.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-[var(--radius-app)] border border-border bg-surface p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="name" required><Input id="name" name="name" required /></Field>
        <Field label="Email" htmlFor="email" required><Input id="email" name="email" type="email" required /></Field>
      </div>
      <Field label="Téléphone" htmlFor="phone"><Input id="phone" name="phone" /></Field>
      <Field label="Votre message" htmlFor="message" required><Textarea id="message" name="message" required className="min-h-32" /></Field>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Envoi…" : "Envoyer ma demande"}</Button>
    </form>
  );
}
