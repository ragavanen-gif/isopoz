"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { euros } from "@/lib/format";
import { saveOrderItemsAction } from "./actions";

type Row = { label: string; qty: string; price: string };
const num = (s: string) => { const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) ? n : 0; };

export function PoItemsEditor({
  poId, initialItems, editable,
}: {
  poId: string;
  initialItems: { label: string; qty: number; unit_price_cents: number }[];
  editable: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(initialItems.map((it) => ({ label: it.label, qty: String(it.qty), price: (it.unit_price_cents / 100).toString() })));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const lines = rows.map((r) => Math.round(num(r.qty) * Math.round(num(r.price) * 100)));
  const total = lines.reduce((s, l) => s + l, 0);

  function save() {
    const payload = rows.filter((r) => r.label.trim() !== "").map((r) => ({
      label: r.label.trim(), qty: num(r.qty), unitPriceCents: Math.round(num(r.price) * 100),
    }));
    startTransition(async () => {
      const res = await saveOrderItemsAction(poId, JSON.stringify(payload));
      setMsg(res?.ok ? { ok: true, text: "Lignes enregistrées." } : { ok: false, text: res?.error ?? "Échec." });
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-[var(--radius-app)] border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-2 py-2 text-left">Produit / désignation</th><th className="px-2 py-2 text-right">Qté</th><th className="px-2 py-2 text-right">PU</th><th className="px-2 py-2 text-right">Total</th>{editable && <th></th>}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && <tr><td colSpan={editable ? 5 : 4} className="px-2 py-6 text-center text-muted-foreground">Aucune ligne.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5">{editable ? <Input value={r.label} onChange={(e) => setRows((x) => x.map((v, j) => j === i ? { ...v, label: e.target.value } : v))} className="h-8 min-w-48" placeholder="Désignation" /> : r.label}</td>
                <td className="px-2 py-1.5 text-right">{editable ? <Input value={r.qty} onChange={(e) => setRows((x) => x.map((v, j) => j === i ? { ...v, qty: e.target.value } : v))} className="h-8 w-16 text-right" inputMode="decimal" /> : r.qty}</td>
                <td className="px-2 py-1.5 text-right">{editable ? <Input value={r.price} onChange={(e) => setRows((x) => x.map((v, j) => j === i ? { ...v, price: e.target.value } : v))} className="h-8 w-24 text-right" inputMode="decimal" /> : euros(Math.round(num(r.price) * 100))}</td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{euros(lines[i])}</td>
                {editable && <td className="px-2 py-1.5 text-right"><button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger"><Trash2 className="size-4" /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && <Button type="button" variant="secondary" size="sm" onClick={() => setRows((x) => [...x, { label: "", qty: "1", price: "0" }])}><Plus /> Ajouter une ligne</Button>}
      <div className="flex justify-end border-t border-border pt-3 text-sm">
        <div className="flex w-56 justify-between text-base font-semibold"><span>Total initial</span><span className="tabular-nums">{euros(total)}</span></div>
      </div>
      {editable && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={pending}><Save /> {pending ? "Enregistrement…" : "Enregistrer les lignes"}</Button>
          {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
