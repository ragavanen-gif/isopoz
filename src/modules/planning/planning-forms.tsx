"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { createScheduleAction, assignToScheduleAction } from "./actions";

type Result = { ok: true } | { ok: false; error: string } | null;

export function CreateScheduleForm({ projects }: { projects: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState<Result, FormData>(createScheduleAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Chantier</label>
        <Select name="projectId" required defaultValue="" className="h-9 min-w-48">
          <option value="" disabled>Sélectionner…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Date</label>
        <Input name="date" type="date" required className="h-9" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Début</label>
        <Input name="startTime" type="time" className="h-9" defaultValue="08:00" />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Fin</label>
        <Input name="endTime" type="time" className="h-9" defaultValue="17:00" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>Créer le créneau</Button>
      {state && !state.ok && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function AssignForm({ scheduleId, employees }: { scheduleId: string; employees: { id: string; label: string }[] }) {
  const action = assignToScheduleAction.bind(null, scheduleId);
  const [state, formAction, pending] = useActionState<Result, FormData>(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select name="employeeId" required defaultValue="" className="h-8 min-w-40 text-sm">
        <option value="" disabled>Affecter un salarié…</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
      </Select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>Affecter</Button>
      {state && !state.ok && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
