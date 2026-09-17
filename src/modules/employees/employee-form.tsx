"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { EMPLOYEE_TYPES, type Employee } from "./schema";

type Result = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | null;

export function EmployeeForm({
  action,
  employee,
  submitLabel,
  defaultType,
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>;
  employee?: Employee;
  submitLabel: string;
  defaultType?: "cdi" | "cdd" | "ephemere";
}) {
  const [state, formAction, pending] = useActionState<Result, FormData>(action, null);
  const [type, setType] = useState(employee?.type ?? defaultType ?? "cdi");
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="firstName" required error={err.firstName}>
            <Input id="firstName" name="firstName" defaultValue={employee?.first_name} required />
          </Field>
          <Field label="Nom" htmlFor="lastName" required error={err.lastName}>
            <Input id="lastName" name="lastName" defaultValue={employee?.last_name} required />
          </Field>
          <Field label="Email" htmlFor="email" error={err.email}>
            <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
          </Field>
          <Field label="Téléphone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={employee?.phone ?? ""} />
          </Field>
          <Field label="Type de contrat" htmlFor="type">
            <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {EMPLOYEE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          {type === "ephemere" && (
            <Field label="Tarif journalier (€)" htmlFor="dailyRate" hint="Rémunération par journée">
              <Input id="dailyRate" name="dailyRate" inputMode="decimal" defaultValue={employee?.daily_rate_cents != null ? (employee.daily_rate_cents / 100).toString() : ""} />
            </Field>
          )}
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={employee?.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</Button>
        <Link href={employee ? `/personnel/salaries/${employee.id}` : "/personnel/salaries"}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
      </div>
    </form>
  );
}
