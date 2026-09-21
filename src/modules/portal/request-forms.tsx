"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { createLeaveRequestAction, createMaterialRequestAction } from "./actions";

type Result = { ok: true } | { ok: false; error: string } | null;

export function LeaveRequestForm() {
  const [state, formAction, pending] = useActionState<Result, FormData>(createLeaveRequestAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <Field label="Type" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="repos"><option value="repos">Jour de repos</option><option value="absence">Absence</option></Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Du" htmlFor="dateFrom"><Input id="dateFrom" name="dateFrom" type="date" required /></Field>
        <Field label="Au" htmlFor="dateTo"><Input id="dateTo" name="dateTo" type="date" required /></Field>
      </div>
      <Field label="Motif (optionnel)" htmlFor="reason"><Textarea id="reason" name="reason" /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Demander"}</Button>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success">Demande envoyée.</p>}
    </form>
  );
}

export function MaterialRequestForm() {
  const [state, formAction, pending] = useActionState<Result, FormData>(createMaterialRequestAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <Field label="Matériel demandé" htmlFor="label"><Input id="label" name="label" required placeholder="Ex : perceuse" /></Field>
      <Field label="Quantité" htmlFor="qty"><Input id="qty" name="qty" type="number" min={1} defaultValue={1} className="w-24" /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Demander"}</Button>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success">Demande envoyée.</p>}
    </form>
  );
}
