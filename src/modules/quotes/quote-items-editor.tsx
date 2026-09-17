"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { euros } from "@/lib/format";
import { saveQuoteItemsAction } from "./actions";
import { computeLineHT, type QuoteItem } from "./schema";

type Row = {
  kind: "prestation" | "produit";
  label: string;
  description: string;
  qty: string;         // saisie libre
  price: string;       // euros
  discount: string;    // %
  vat: string;         // %
};

function fromItem(it: QuoteItem): Row {
  return {
    kind: it.kind,
    label: it.label,
    description: it.description ?? "",
    qty: String(it.qty),
    price: (it.unit_price_cents / 100).toString(),
    discount: (it.discount_bps / 100).toString(),
    vat: (it.vat_bps / 100).toString(),
  };
}

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function QuoteItemsEditor({
  quoteId,
  initialItems,
  editable,
  defaultVat,
}: {
  quoteId: string;
  initialItems: QuoteItem[];
  editable: boolean;
  defaultVat: number; // en %
}) {
  const [rows, setRows] = useState<Row[]>(initialItems.map(fromItem));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setSaved(null);
  }
  function addRow() {
    setRows((r) => [
      ...r,
      { kind: "prestation", label: "", description: "", qty: "1", price: "0", discount: "0", vat: String(defaultVat) },
    ]);
    setSaved(null);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
    setSaved(null);
  }

  const lines = rows.map((r) => {
    const cents = Math.round(num(r.price) * 100);
    const ht = computeLineHT(num(r.qty), cents, Math.round(num(r.discount) * 100));
    const vat = Math.round((ht * num(r.vat)) / 100);
    return { ht, vat };
  });
  const subtotal = lines.reduce((s, l) => s + l.ht, 0);
  const vatTotal = lines.reduce((s, l) => s + l.vat, 0);

  function save() {
    setError(null);
    const payload = rows
      .filter((r) => r.label.trim() !== "")
      .map((r) => ({
        kind: r.kind,
        label: r.label.trim(),
        description: r.description,
        qty: num(r.qty),
        unitPriceCents: Math.round(num(r.price) * 100),
        discountBps: Math.round(num(r.discount) * 100),
        vatBps: Math.round(num(r.vat) * 100),
      }));
    startTransition(async () => {
      const res = await saveQuoteItemsAction(quoteId, JSON.stringify(payload));
      if (res?.ok) setSaved("Lignes enregistrées.");
      else setError(res?.error ?? "Échec de l'enregistrement.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-[var(--radius-app)] border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-left">Désignation</th>
              <th className="px-2 py-2 text-right">Qté</th>
              <th className="px-2 py-2 text-right">PU HT</th>
              <th className="px-2 py-2 text-right">Rem. %</th>
              <th className="px-2 py-2 text-right">TVA %</th>
              <th className="px-2 py-2 text-right">Total HT</th>
              {editable && <th className="px-2 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr><td colSpan={editable ? 8 : 7} className="px-2 py-6 text-center text-muted-foreground">Aucune ligne.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5">
                  {editable ? (
                    <Select value={r.kind} onChange={(e) => update(i, { kind: e.target.value as Row["kind"] })} className="h-8 w-28">
                      <option value="prestation">Prestation</option>
                      <option value="produit">Produit</option>
                    </Select>
                  ) : (r.kind === "prestation" ? "Prestation" : "Produit")}
                </td>
                <td className="px-2 py-1.5">
                  {editable ? (
                    <Input value={r.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Désignation" className="h-8 min-w-48" />
                  ) : r.label}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {editable ? <Input value={r.qty} onChange={(e) => update(i, { qty: e.target.value })} className="h-8 w-16 text-right" inputMode="decimal" /> : r.qty}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {editable ? <Input value={r.price} onChange={(e) => update(i, { price: e.target.value })} className="h-8 w-24 text-right" inputMode="decimal" /> : euros(Math.round(num(r.price) * 100))}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {editable ? <Input value={r.discount} onChange={(e) => update(i, { discount: e.target.value })} className="h-8 w-16 text-right" inputMode="decimal" /> : `${r.discount} %`}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {editable ? <Input value={r.vat} onChange={(e) => update(i, { vat: e.target.value })} className="h-8 w-16 text-right" inputMode="decimal" /> : `${r.vat} %`}
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{euros(lines[i].ht)}</td>
                {editable && (
                  <td className="px-2 py-1.5 text-right">
                    <button type="button" onClick={() => removeRow(i)} className="text-muted-foreground hover:text-danger" aria-label="Supprimer la ligne">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable && (
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          <Plus /> Ajouter une ligne
        </Button>
      )}

      <div className="flex flex-col items-end gap-1 border-t border-border pt-3 text-sm">
        <div className="flex w-64 justify-between"><span className="text-muted-foreground">Total HT</span><span className="tabular-nums font-medium">{euros(subtotal)}</span></div>
        <div className="flex w-64 justify-between"><span className="text-muted-foreground">TVA</span><span className="tabular-nums">{euros(vatTotal)}</span></div>
        <div className="flex w-64 justify-between text-base font-semibold"><span>Total TTC</span><span className="tabular-nums">{euros(subtotal + vatTotal)}</span></div>
      </div>

      {editable && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={pending}>
            <Save /> {pending ? "Enregistrement…" : "Enregistrer les lignes"}
          </Button>
          {saved && <span className="text-sm text-success">{saved}</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}
