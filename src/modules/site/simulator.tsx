"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { euros } from "@/lib/format";
import { submitSimulatorAction } from "./public-actions";
import type { SimService } from "./queries";

type Line = { serviceId: string; surface: string };

export function Simulator({ services, title }: { services: SimService[]; title: string }) {
  const [lines, setLines] = useState<Line[]>([{ serviceId: services[0]?.id ?? "", surface: "" }]);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => { const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const svc = (id: string) => services.find((s) => s.id === id);

  const computed = lines.map((l) => {
    const s = svc(l.serviceId);
    const amount = s ? Math.round(num(l.surface) * s.unit_price_cents) : 0;
    return { name: s?.name ?? "", amount };
  });
  const total = computed.reduce((sum, c) => sum + c.amount, 0);

  function submit() {
    setError(null);
    if (!contact.name.trim() || !contact.email.trim()) {
      setError("Renseignez votre nom et votre email pour recevoir l'estimation.");
      return;
    }
    const payload = {
      name: contact.name.trim(), email: contact.email.trim(), phone: contact.phone.trim(),
      estimateCents: total,
      lines: computed.filter((c) => c.amount > 0).map((c) => ({ service: c.name, qty: 0, amountCents: c.amount })),
    };
    startTransition(async () => {
      const res = await submitSimulatorAction(JSON.stringify(payload));
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (services.length === 0) return null;

  if (done) {
    return (
      <div className="rounded-[var(--radius-app)] border border-border bg-surface p-8 text-center">
        <p className="text-lg font-semibold text-success">Merci !</p>
        <p className="mt-2 text-sm text-muted-foreground">Votre demande a bien été envoyée. Nous vous recontactons rapidement avec un devis précis.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-app)] border border-border bg-surface p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>

      <div className="space-y-3">
        {lines.map((l, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Prestation</label>
              <Select value={l.serviceId} onChange={(e) => setLines((x) => x.map((v, j) => j === i ? { ...v, serviceId: e.target.value } : v))} className="h-10">
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Surface ({svc(l.serviceId)?.unit_label ?? "m²"})</label>
              <Input value={l.surface} onChange={(e) => setLines((x) => x.map((v, j) => j === i ? { ...v, surface: e.target.value } : v))} className="h-10 w-28" inputMode="decimal" placeholder="0" />
            </div>
            <div className="w-24 text-right">
              <label className="block text-xs text-muted-foreground">Estimation</label>
              <span className="text-sm font-medium tabular-nums">{euros(computed[i].amount)}</span>
            </div>
            {lines.length > 1 && (
              <button type="button" onClick={() => setLines((x) => x.filter((_, j) => j !== i))} className="mb-2 text-muted-foreground hover:text-danger"><Trash2 className="size-4" /></button>
            )}
          </div>
        ))}
      </div>

      <button type="button" onClick={() => setLines((x) => [...x, { serviceId: services[0]?.id ?? "", surface: "" }])} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <Plus className="size-4" /> Ajouter une prestation
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">Estimation totale indicative</span>
        <span className="text-2xl font-bold tabular-nums text-primary">{euros(total)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Estimation non contractuelle. Un devis précis vous sera envoyé.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input placeholder="Votre nom" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
        <Input placeholder="Votre email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
        <Input placeholder="Téléphone (optionnel)" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <Button className="mt-4 w-full sm:w-auto" onClick={submit} disabled={pending} size="lg">
        {pending ? "Envoi…" : "Recevoir mon devis gratuit"}
      </Button>
    </div>
  );
}
