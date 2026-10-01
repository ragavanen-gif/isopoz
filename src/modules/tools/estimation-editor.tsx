"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Ruler, Crosshair, Hand, Search, Save, Trash2, ZoomIn, ZoomOut, Maximize,
  Eye, EyeOff, Download, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { euros } from "@/lib/format";
import { saveEstimationAction } from "./actions";
import type { EstimationProject, Measurement, Prestation } from "./queries";

const COLORS = ["#E8641C", "#1d4ed8", "#16a34a", "#dc2626", "#9333ea", "#0891b2", "#ca8a04", "#db2777"];
const RENDER_SCALE = 2; // qualité de rendu du PDF
type Tool = "pan" | "measure" | "calibrate" | "search";
type Pt = { x: number; y: number };

const STATUS_LABEL: Record<Measurement["status"], string> = {
  manuel: "Manuel", detecte: "Détecté", a_verifier: "À vérifier", confirme: "Confirmé",
};

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, "").replace("dn", "dn").replace("ø", "o").replace("×", "x").replace("diam", "o");
}

export function EstimationEditor({ project, prestations }: { project: EstimationProject; prestations: Prestation[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [zoom, setZoom] = useState(0.5);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("pan");

  const [measurements, setMeasurements] = useState<Measurement[]>(project.measurements ?? []);
  const [scaleFactor, setScaleFactor] = useState<number | null>(project.scale_factor);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState("DN20");
  const [colorIdx, setColorIdx] = useState(0);

  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<{ x: number; y: number; text: string }[]>([]);
  const textItemsRef = useRef<{ x: number; y: number; w: number; h: number; str: string }[]>([]);

  const panStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  // --- Chargement du PDF ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/plans/${project.id}/url`);
        if (!res.ok) throw new Error("Impossible de charger le plan.");
        const { url } = await res.json();
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument(url).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        if (cancelled) return;
        const canvas = canvasRef.current!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        // texte pour la recherche (coords en base pixels = RENDER_SCALE)
        const tc = await page.getTextContent();
        textItemsRef.current = tc.items.map((it) => {
          const i = it as { str: string; transform: number[]; width: number; height: number };
          const tx = i.transform;
          const x = tx[4] * RENDER_SCALE;
          const y = viewport.height - tx[5] * RENDER_SCALE;
          return { x, y, w: i.width * RENDER_SCALE, h: (i.height || 8) * RENDER_SCALE, str: i.str };
        });
        setDims({ w: viewport.width, h: viewport.height });
        // zoom initial pour tenir dans le conteneur
        const cw = containerRef.current?.clientWidth ?? 800;
        setZoom(Math.min(1, (cw - 32) / viewport.width));
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setLoadError(e instanceof Error ? e.message : "Erreur de chargement."); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [project.id]);

  // --- Conversions écran <-> base ---
  const toBase = useCallback((clientX: number, clientY: number): Pt => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - offset.x) / zoom, y: (clientY - rect.top - offset.y) / zoom };
  }, [offset, zoom]);

  const segLenBase = (pts: Pt[]) => {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return d;
  };
  const lenMeters = (pts: Pt[]) => (scaleFactor ? segLenBase(pts) * scaleFactor : 0);

  // --- Interactions ---
  function onPointerDown(e: React.PointerEvent) {
    if (tool === "pan") {
      panStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (tool === "pan" && panStart.current) {
      const p = panStart.current;
      setOffset({ x: p.ox + (e.clientX - p.mx), y: p.oy + (e.clientY - p.my) });
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (tool === "pan") { panStart.current = null; try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {} }
  }

  function onClick(e: React.MouseEvent) {
    if (tool === "measure" || tool === "calibrate") {
      const p = toBase(e.clientX, e.clientY);
      const next = [...draft, p];
      setDraft(next);
      if (tool === "calibrate" && next.length === 2) {
        const px = segLenBase(next);
        const input = window.prompt(`Cette distance mesure combien en mètres ?\n(distance tracée : ${px.toFixed(1)} px)`, "5");
        const meters = input ? parseFloat(input.replace(",", ".")) : NaN;
        if (Number.isFinite(meters) && meters > 0 && px > 0) {
          setScaleFactor(meters / px);
          setDirty(true);
        }
        setDraft([]);
        setTool("pan");
      }
    }
  }
  function finishMeasure() {
    if (tool === "measure" && draft.length >= 2) {
      const m: Measurement = {
        id: crypto.randomUUID(), category: category || "Mesure", color: COLORS[colorIdx % COLORS.length],
        points: draft, lengthM: lenMeters(draft), status: "manuel",
      };
      setMeasurements((x) => [...x, m]);
      setDirty(true);
    }
    setDraft([]);
  }

  // recalcule les longueurs si l'échelle change
  useEffect(() => {
    if (scaleFactor != null) {
      setMeasurements((prev) => prev.map((m) => ({ ...m, lengthM: segLenBase(m.points) * scaleFactor })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleFactor]);

  function runSearch() {
    const q = normalize(searchQ);
    if (!q) { setSearchHits([]); return; }
    const hits = textItemsRef.current.filter((t) => normalize(t.str).includes(q)).map((t) => ({ x: t.x, y: t.y - t.h, text: t.str }));
    setSearchHits(hits);
  }

  async function save() {
    setSaving(true);
    const res = await saveEstimationAction(project.id, scaleFactor, JSON.stringify(measurements));
    setSaving(false);
    if (res.ok) { setDirty(false); router.refresh(); }
    else alert(res.error);
  }

  function exportCsv() {
    const header = ["Repère", "Catégorie", "Longueur (m)", "Statut", "Prestation", "Unité", "PU (€)", "Montant (€)"];
    const rows = measurements.map((m, i) => {
      const p = prestations.find((pr) => pr.id === m.prestationId);
      const pu = p ? (p.price_supply_cents + p.price_install_cents) * (1 + p.margin_bps / 10000) / 100 : 0;
      const qty = p?.unit === "u" || p?.unit === "forfait" ? 1 : m.lengthM;
      return [i + 1, m.category, m.lengthM.toFixed(2), STATUS_LABEL[m.status], p?.name ?? "", p?.unit ?? "ml", pu.toFixed(2), (pu * qty).toFixed(2)];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name}-metre.csv`;
    a.click();
  }

  // --- Chiffrage ---
  const chiffrage = measurements.map((m) => {
    const p = prestations.find((pr) => pr.id === m.prestationId);
    const puCents = p ? Math.round((p.price_supply_cents + p.price_install_cents) * (1 + p.margin_bps / 10000)) : 0;
    const qty = p && (p.unit === "u" || p.unit === "forfait") ? 1 : m.lengthM;
    return { m, p, puCents, qty, totalCents: Math.round(puCents * qty) };
  });
  const totalCents = chiffrage.reduce((s, c) => s + c.totalCents, 0);
  const totalML = measurements.reduce((s, m) => s + m.lengthM, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* Plan */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-app)] border border-border bg-surface p-2">
          <Button size="sm" variant={tool === "pan" ? "primary" : "secondary"} onClick={() => { setTool("pan"); setDraft([]); }}><Hand /> Déplacer</Button>
          <Button size="sm" variant={tool === "calibrate" ? "primary" : "secondary"} onClick={() => { setTool("calibrate"); setDraft([]); }}><Crosshair /> Calibrer</Button>
          <Button size="sm" variant={tool === "measure" ? "primary" : "secondary"} onClick={() => { setTool("measure"); setDraft([]); }}><Ruler /> Mesurer</Button>
          {tool === "measure" && draft.length >= 2 && <Button size="sm" variant="accent" onClick={finishMeasure}><Plus /> Terminer la mesure</Button>}
          <div className="mx-1 h-6 w-px bg-border" />
          <Button size="sm" variant="secondary" onClick={() => setZoom((z) => z * 1.25)}><ZoomIn /></Button>
          <Button size="sm" variant="secondary" onClick={() => setZoom((z) => z / 1.25)}><ZoomOut /></Button>
          <Button size="sm" variant="secondary" onClick={() => { setZoom(Math.min(1, ((containerRef.current?.clientWidth ?? 800) - 32) / (dims?.w ?? 800))); setOffset({ x: 0, y: 0 }); }}><Maximize /></Button>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {scaleFactor ? <span className="text-success">Échelle calibrée ✓</span> : <span className="text-warning">Échelle à calibrer</span>}
            <Button size="sm" onClick={save} disabled={saving || !dirty}><Save /> {saving ? "…" : dirty ? "Enregistrer" : "Enregistré"}</Button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative h-[70vh] overflow-hidden rounded-[var(--radius-app)] border border-border bg-muted"
          style={{ cursor: tool === "pan" ? "grab" : "crosshair" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={onClick}
        >
          {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Chargement du plan…</div>}
          {loadError && <div className="absolute inset-0 flex items-center justify-center text-sm text-danger">{loadError}</div>}
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
            <canvas ref={canvasRef} className="block" />
            {dims && (
              <svg width={dims.w} height={dims.h} className="pointer-events-none absolute left-0 top-0">
                {measurements.filter((m) => !hidden.has(m.id)).map((m) => (
                  <polyline key={m.id} points={m.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none" stroke={m.color} strokeWidth={selected === m.id ? 6 / zoom : 3 / zoom}
                    strokeLinejoin="round" strokeLinecap="round" opacity={selected && selected !== m.id ? 0.4 : 1} />
                ))}
                {draft.length > 0 && (
                  <polyline points={draft.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#E8641C" strokeDasharray={`${8 / zoom},${6 / zoom}`} strokeWidth={3 / zoom} />
                )}
                {draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5 / zoom} fill="#E8641C" />)}
                {searchHits.map((h, i) => <rect key={i} x={h.x} y={h.y} width={60} height={18} fill="#1d4ed8" opacity={0.35} />)}
              </svg>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {tool === "calibrate" && "Cliquez 2 points sur une cote connue, puis saisissez la distance réelle."}
          {tool === "measure" && "Cliquez pour tracer les points du réseau, puis « Terminer la mesure »."}
          {tool === "pan" && "Glissez pour déplacer, molette +/- pour zoomer."}
        </p>
      </div>

      {/* Panneau droit */}
      <div className="space-y-4">
        {/* Recherche */}
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Search className="size-4" /> Rechercher sur le plan</p>
          <div className="flex gap-2">
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="DN20, Ø160, 550x300…" className="h-9" onKeyDown={(e) => e.key === "Enter" && runSearch()} />
            <Button size="sm" onClick={runSearch}>Chercher</Button>
          </div>
          {searchHits.length > 0 && <p className="mt-2 text-xs text-info">{searchHits.length} occurrence(s) surlignée(s) en bleu. À mesurer pour obtenir les longueurs.</p>}
          {searchQ && searchHits.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Aucune occurrence texte (le PDF n'est peut-être pas vectoriel).</p>}
        </div>

        {/* Paramètres de mesure */}
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold">Nouvelle mesure</p>
          <div className="space-y-2">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie (DN20, Gaine 550x300…)" className="h-9" />
            <div className="flex flex-wrap gap-1">
              {COLORS.map((c, i) => (
                <button key={c} type="button" onClick={() => setColorIdx(i)} className="size-6 rounded-full border-2" style={{ background: c, borderColor: colorIdx === i ? "#000" : "transparent" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Liste des mesures */}
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold">Mesures ({measurements.length}) · total {totalML.toFixed(2)} m</p>
          {measurements.length === 0 ? <p className="text-xs text-muted-foreground">Aucune mesure. Calibrez l'échelle puis mesurez.</p> : (
            <ul className="space-y-2 text-sm">
              {measurements.map((m) => (
                <li key={m.id} className={`rounded-md border p-2 ${selected === m.id ? "border-primary" : "border-border"}`} onMouseEnter={() => setSelected(m.id)} onMouseLeave={() => setSelected(null)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-full" style={{ background: m.color }} /> {m.category}</span>
                    <span className="tabular-nums font-medium">{m.lengthM.toFixed(2)} m</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Select value={m.prestationId ?? ""} onChange={(e) => { setMeasurements((x) => x.map((v) => v.id === m.id ? { ...v, prestationId: e.target.value || null } : v)); setDirty(true); }} className="h-8 flex-1 text-xs">
                      <option value="">— Prestation —</option>
                      {prestations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                    <button type="button" onClick={() => setHidden((h) => { const n = new Set(h); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })} className="text-muted-foreground hover:text-foreground" title="Afficher/masquer">
                      {hidden.has(m.id) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                    <button type="button" onClick={() => { setMeasurements((x) => x.filter((v) => v.id !== m.id)); setDirty(true); }} className="text-muted-foreground hover:text-danger" title="Supprimer"><Trash2 className="size-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Chiffrage */}
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Chiffrage</p>
            <Button size="sm" variant="secondary" onClick={exportCsv}><Download /> CSV</Button>
          </div>
          {chiffrage.filter((c) => c.p).length === 0 ? (
            <p className="text-xs text-muted-foreground">Associez des prestations à vos mesures pour chiffrer.</p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                {chiffrage.filter((c) => c.p).map((c) => (
                  <li key={c.m.id} className="flex items-center justify-between">
                    <span className="truncate text-xs">{c.m.category} · {c.p!.name}</span>
                    <span className="tabular-nums">{euros(c.totalCents)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold">
                <span>Total HT</span><span className="tabular-nums text-primary">{euros(totalCents)}</span>
              </div>
            </>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Rappel : seules les longueurs réellement mesurées sont comptées. Rien n'est inventé.</p>
        </div>
      </div>
    </div>
  );
}
