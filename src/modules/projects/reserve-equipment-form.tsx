"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { reserveEquipmentAction } from "./actions";

type Result = { ok: true } | { ok: false; error: string } | null;

export function ReserveEquipmentForm({
  projectId,
  equipment,
}: {
  projectId: string;
  equipment: { id: string; name: string; quantity: number }[];
}) {
  const action = reserveEquipmentAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState<Result, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Matériel</label>
        <Select name="equipmentId" required defaultValue="" className="h-9 min-w-44">
          <option value="" disabled>Sélectionner…</option>
          {equipment.map((e) => <option key={e.id} value={e.id}>{e.name} (×{e.quantity})</option>)}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Qté</label>
        <Input name="qty" type="number" min={1} defaultValue={1} className="h-9 w-16" />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Du</label>
        <Input name="reservedFrom" type="date" className="h-9" />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Au</label>
        <Input name="reservedTo" type="date" className="h-9" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>Réserver</Button>
      {state && !state.ok && <p className="w-full text-sm text-danger">⚠ {state.error}</p>}
    </form>
  );
}
