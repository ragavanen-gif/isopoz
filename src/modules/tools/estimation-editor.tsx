"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Ruler, Crosshair, Hand, Search, Save, Trash2, ZoomIn, ZoomOut, Maximize,
  Eye, EyeOff, Download, Plus, CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { euros } from "@/lib/format";
import { saveEstimationAction } from "./actions";
import { extractPolylines, polyLenPx, distToPolyline, type Polyline } from "./pdf-geometry";
import type { EstimationProject, Measurement, Prestation } from "./queries";

const COLORS = ["#E8641C", "#1d4ed8", "#16a34a", "#dc2626", "#9333ea", "#0891b2", "#ca8a04", "#db2777"];
const RENDER_SCALE = 2; // qualité de rendu du PDF
const PT_TO_M = 0.0254 / 72; // 1 point PDF = 1/72 pouce, en mètres (PDF à taille réelle)
/** Mètres réels par pixel de base, à partir de l'échelle imprimée (ex : 50 pour 1/50). */
function scaleFromRatio(ratio: number) { return (1 / RENDER_SCALE) * PT_TO_M * ratio; }
type Tool = "pan" | "measure" | "calibrate" | "search" | "count";
type Pt = { x: number; y: number };

/** Quantité d'une mesure : nombre d'accessoires (count) ou longueur en m (length). */
function qtyOf(m: Measurement): number {
  return m.kind === "count" ? m.points.length : m.lengthM;
}

type Detection = { famille: "hydraulique" | "aeraulique"; dimension: string; designation: string; plusC: boolean };
type AnalysisRow = { famille: "hydraulique" | "aeraulique"; dimension: string; reseaux: string[]; plusC: number; occurrences: number };

/** Extrait les désignations (DN, Ø, dimensions de gaine, réseaux, +C) d'un texte. */
function parseText(s: string): Detection[] {
  const out: Detection[] = [];
  const plusC = /\+\s?c\b/i.test(s);
  const designation = (() => {
    const m = s.split(/\s[-–]\s/)[0].trim();
    return /^[A-Za-z]{2,5}\d{0,3}[-–]?[A-Za-z0-9]{0,3}$/.test(m) && m.length <= 10 ? m.toUpperCase() : "—";
  })();
  // Hydraulique : DN
  for (const m of s.matchAll(/\bdn\s?0*(\d{1,4})\b/gi)) out.push({ famille: "hydraulique", dimension: `DN${m[1]}`, designation, plusC });
  // Aéraulique circulaire : Ø / O / diam
  for (const m of s.matchAll(/[øØ]\s?0*(\d{2,4})/g)) out.push({ famille: "aeraulique", dimension: `Ø${m[1]}`, designation, plusC });
  // Aéraulique rectangulaire : AxB (optionnellement "ht")
  for (const m of s.matchAll(/\b(\d{2,4})\s?[x×]\s?(\d{2,4})\s?(?:ht)?\b/gi)) out.push({ famille: "aeraulique", dimension: `${m[1]}x${m[2]}`, designation, plusC });
  return out;
}

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
  const polylinesRef = useRef<Polyline[]>([]);
  const [vectorCount, setVectorCount] = useState<number | null>(null); // lignes vectorielles trouvées (diagnostic)

  const [planRatio, setPlanRatio] = useState("50"); // 1/50 par défaut
  const [analysis, setAnalysis] = useState<AnalysisRow[] | null>(null);
  const [anaFilter, setAnaFilter] = useState<"all" | "hydraulique" | "aeraulique" | "plusc">("all");

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
        // Géométrie vectorielle (lignes/polylignes) pour la détection auto des longueurs
        try {
          const opList = await page.getOperatorList();
          polylinesRef.current = extractPolylines(opList, viewport, pdfjs.OPS as unknown as Record<string, number>);
        } catch { polylinesRef.current = []; }
        setVectorCount(polylinesRef.current.length);
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
    if (tool === "measure" || tool === "calibrate" || tool === "count") {
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
      if (!scaleFactor) alert("⚠️ Échelle non calibrée : la longueur sera 0 m. Calibrez l'échelle (panneau « Échelle ») puis remesurez.");
      const m: Measurement = {
        id: crypto.randomUUID(), kind: "length", category: category || "Mesure", color: COLORS[colorIdx % COLORS.length],
        points: draft, lengthM: lenMeters(draft), status: "manuel",
      };
      setMeasurements((x) => [...x, m]);
      setDirty(true);
    } else if (tool === "count" && draft.length >= 1) {
      const m: Measurement = {
        id: crypto.randomUUID(), kind: "count", category: category || "Accessoire", color: COLORS[colorIdx % COLORS.length],
        points: draft, lengthM: 0, status: "manuel",
      };
      setMeasurements((x) => [...x, m]);
      setDirty(true);
    }
    setDraft([]);
  }

  // recalcule les longueurs si l'échelle change
  useEffect(() => {
    if (scaleFactor != null) {
      setMeasurements((prev) => prev.map((m) => m.kind === "count" ? m : ({ ...m, lengthM: segLenBase(m.points) * scaleFactor })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleFactor]);

  function runSearch() {
    const q = normalize(searchQ);
    if (!q) { setSearchHits([]); return; }
    const hits = textItemsRef.current.filter((t) => normalize(t.str).includes(q)).map((t) => ({ x: t.x, y: t.y - t.h, text: t.str }));
    setSearchHits(hits);
  }

  /** Applique l'échelle imprimée du plan (1/ratio). À vérifier avec une cote connue. */
  function applyPlanScale() {
    const ratio = parseFloat(planRatio.replace(",", "."));
    if (Number.isFinite(ratio) && ratio > 0) { setScaleFactor(scaleFromRatio(ratio)); setDirty(true); }
  }

  /** Analyse tout le plan : extrait et regroupe les désignations détectées (CDC §23-24). */
  function runAnalysis() {
    const groups = new Map<string, AnalysisRow>();
    for (const t of textItemsRef.current) {
      for (const d of parseText(t.str)) {
        const key = `${d.famille}|${d.dimension}`;
        const g = groups.get(key) ?? { famille: d.famille, dimension: d.dimension, reseaux: [], plusC: 0, occurrences: 0 };
        g.occurrences += 1;
        if (d.plusC) g.plusC += 1;
        if (d.designation !== "—" && !g.reseaux.includes(d.designation)) g.reseaux.push(d.designation);
        groups.set(key, g);
      }
    }
    const rows = Array.from(groups.values()).sort((a, b) => a.famille.localeCompare(b.famille) || a.dimension.localeCompare(b.dimension, undefined, { numeric: true }));
    setAnalysis(rows);
  }

  /** Prépare une mesure pour une dimension détectée (choisir quoi chiffrer) + surligne. */
  function pickForMeasure(row: AnalysisRow) {
    if (!scaleFactor) {
      alert("Calibrez d'abord l'échelle (panneau « Échelle » : tapez 50 → Appliquer, ou utilisez « Calibrer » sur une cote connue). Sinon la longueur sera 0.");
    }
    setCategory(row.dimension);
    setTool("measure");
    setSearchQ(row.dimension);
    const q = normalize(row.dimension);
    setSearchHits(textItemsRef.current.filter((t) => normalize(t.str).includes(q)).map((t) => ({ x: t.x, y: t.y - t.h, text: t.str })));
    // Remonte au plan pour tracer
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const DETECT_RADIUS = 90; // px de base : distance max étiquette ↔ polyligne

  /** Trouve les polylignes proches des étiquettes d'une dimension (détection auto). */
  function detectPolylines(dimension: string): number[] {
    const q = normalize(dimension);
    const labels = textItemsRef.current.filter((t) => normalize(t.str).includes(q));
    const used = new Set<number>();
    for (const t of labels) {
      const anchor = { x: t.x + t.w / 2, y: t.y - t.h / 2 };
      let best = -1, bestD = DETECT_RADIUS;
      polylinesRef.current.forEach((poly, idx) => {
        if (poly.points.length < 2) return;
        const d = distToPolyline(anchor, poly.points);
        if (d < bestD) { bestD = d; best = idx; }
      });
      if (best >= 0) used.add(best);
    }
    return Array.from(used);
  }

  /** Détecte automatiquement les longueurs d'une dimension (statut « détecté »). */
  function autoDetectRow(row: AnalysisRow) {
    if (!scaleFactor) { alert("Calibrez l'échelle d'abord (panneau « Échelle »). Sans échelle, impossible de calculer les longueurs."); return; }
    const idxs = detectPolylines(row.dimension);
    const color = COLORS[(row.famille === "hydraulique" ? 1 : 0)];
    // Remplace les détections existantes pour cette dimension
    setMeasurements((prev) => {
      const kept = prev.filter((m) => !(m.status === "detecte" && m.category === row.dimension));
      const added: Measurement[] = idxs.map((i) => {
        const pts = polylinesRef.current[i].points;
        return { id: crypto.randomUUID(), kind: "length" as const, category: row.dimension, color, points: pts, lengthM: polyLenPx(pts) * scaleFactor, status: "detecte" as const };
      });
      return [...kept, ...added];
    });
    setDirty(true);
    if (idxs.length === 0) alert(`Aucune ligne détectée automatiquement près des étiquettes « ${row.dimension} ». Mesurez manuellement (bouton « Mesurer »).`);
    else containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /** Détecte toutes les longueurs de toutes les dimensions analysées. */
  function autoDetectAll() {
    if (!scaleFactor) { alert("Calibrez l'échelle d'abord (panneau « Échelle »)."); return; }
    if (!analysis) return;
    setMeasurements((prev) => {
      const kept = prev.filter((m) => m.status !== "detecte");
      const added: Measurement[] = [];
      for (const row of analysis) {
        const color = COLORS[(row.famille === "hydraulique" ? 1 : 0)];
        for (const i of detectPolylines(row.dimension)) {
          const pts = polylinesRef.current[i].points;
          added.push({ id: crypto.randomUUID(), kind: "length", category: row.dimension, color, points: pts, lengthM: polyLenPx(pts) * scaleFactor, status: "detecte" });
        }
      }
      return [...kept, ...added];
    });
    setDirty(true);
  }

  /** Longueur détectée/mesurée pour une dimension (somme). */
  function detectedLength(dimension: string): number {
    return measurements.filter((m) => m.category === dimension && m.kind !== "count").reduce((s, m) => s + m.lengthM, 0);
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
  const totalML = measurements.reduce((s, m) => s + (m.kind === "count" ? 0 : m.lengthM), 0);
  const totalAcc = measurements.reduce((s, m) => s + (m.kind === "count" ? m.points.length : 0), 0);

  // Tableau récapitulatif groupé par prestation (désignation · dimension · épaisseur · finition)
  const recap = (() => {
    const map = new Map<string, { p?: Prestation; label: string; qty: number; unit: string; puCents: number }>();
    for (const m of measurements) {
      const p = prestations.find((pr) => pr.id === m.prestationId);
      const key = p ? p.id : `__${m.category}__${m.kind}`;
      const unit = p?.unit ?? (m.kind === "count" ? "u" : "ml");
      const puCents = p ? Math.round((p.price_supply_cents + p.price_install_cents) * (1 + p.margin_bps / 10000)) : 0;
      const label = p ? p.name : m.category;
      const cur = map.get(key) ?? { p, label, qty: 0, unit, puCents };
      cur.qty += qtyOf(m);
      map.set(key, cur);
    }
    return Array.from(map.values()).map((r) => ({ ...r, totalCents: Math.round(r.puCents * r.qty) }));
  })();

  const anaRows = (analysis ?? []).filter((r) =>
    anaFilter === "all" ? true : anaFilter === "plusc" ? r.plusC > 0 : r.famille === anaFilter);

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* Plan */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-app)] border border-border bg-surface p-2">
          <Button size="sm" variant={tool === "pan" ? "primary" : "secondary"} onClick={() => { setTool("pan"); setDraft([]); }}><Hand /> Déplacer</Button>
          <Button size="sm" variant={tool === "calibrate" ? "primary" : "secondary"} onClick={() => { setTool("calibrate"); setDraft([]); }}><Crosshair /> Calibrer</Button>
          <Button size="sm" variant={tool === "measure" ? "primary" : "secondary"} onClick={() => { setTool("measure"); setDraft([]); }}><Ruler /> Mesurer</Button>
          <Button size="sm" variant={tool === "count" ? "primary" : "secondary"} onClick={() => { setTool("count"); setDraft([]); }}><CircleDot /> Compter</Button>
          {tool === "measure" && draft.length >= 1 && (
            <span className="rounded-md bg-accent/10 px-2 py-1 text-sm font-medium text-accent">
              Longueur en cours : {scaleFactor ? `${lenMeters(draft).toFixed(2)} m` : "échelle non calibrée"}
            </span>
          )}
          {((tool === "measure" && draft.length >= 2) || (tool === "count" && draft.length >= 1)) && <Button size="sm" variant="accent" onClick={finishMeasure}><Plus /> Terminer ({tool === "count" ? `${draft.length} U` : `${lenMeters(draft).toFixed(2)} m`})</Button>}
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
                  m.kind === "count" ? (
                    <g key={m.id} opacity={selected && selected !== m.id ? 0.4 : 1}>
                      {m.points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={(selected === m.id ? 9 : 7) / zoom} fill={m.color} stroke="#fff" strokeWidth={2 / zoom} />
                      ))}
                    </g>
                  ) : (
                    <polyline key={m.id} points={m.points.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none" stroke={m.color} strokeWidth={selected === m.id ? 6 / zoom : 3 / zoom}
                      strokeLinejoin="round" strokeLinecap="round" opacity={selected && selected !== m.id ? 0.4 : 1} />
                  )
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
        {/* Échelle */}
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
          <p className="mb-2 text-sm font-semibold">Échelle</p>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Échelle du plan 1/</label>
              <Input value={planRatio} onChange={(e) => setPlanRatio(e.target.value)} className="h-9 w-20" inputMode="numeric" />
            </div>
            <Button size="sm" variant="secondary" onClick={applyPlanScale}>Appliquer</Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {scaleFactor ? `Échelle active : 1 px ≈ ${(scaleFactor).toFixed(4)} m.` : "Non calibrée."} ⚠️ À confirmer avec le bouton « Calibrer » sur une cote connue (le PDF n'est pas toujours à sa taille réelle).
          </p>
        </div>

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
          <p className="mb-2 text-sm font-semibold">Mesures ({measurements.length}) · {totalML.toFixed(2)} m{totalAcc > 0 ? ` · ${totalAcc} accessoire(s)` : ""}</p>
          {measurements.length === 0 ? <p className="text-xs text-muted-foreground">Aucune mesure. Calibrez l'échelle puis mesurez.</p> : (
            <ul className="space-y-2 text-sm">
              {measurements.map((m) => (
                <li key={m.id} className={`rounded-md border p-2 ${selected === m.id ? "border-primary" : "border-border"}`} onMouseEnter={() => setSelected(m.id)} onMouseLeave={() => setSelected(null)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-full" style={{ background: m.color }} /> {m.category}{m.kind === "count" ? " (accessoire)" : ""}</span>
                    <span className="tabular-nums font-medium">{m.kind === "count" ? `× ${m.points.length} U` : `${m.lengthM.toFixed(2)} m`}</span>
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

        {/* Tableau récapitulatif / chiffrage */}
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Tableau de métré / chiffrage</p>
            <Button size="sm" variant="secondary" onClick={exportCsv}><Download /> CSV</Button>
          </div>
          {recap.length === 0 ? (
            <p className="text-xs text-muted-foreground">Mesurez ou comptez des éléments pour alimenter le tableau.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr><th className="py-1 pr-2">Désignation</th><th className="pr-2">Ép.</th><th className="pr-2 text-right">Qté</th><th className="pr-2">Unité</th><th className="text-right">Montant</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recap.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">{r.label}{r.p?.dimension ? ` · ${r.p.dimension}` : ""}{r.p?.finish ? ` · ${r.p.finish}` : ""}</td>
                      <td className="pr-2 text-muted-foreground">{r.p?.thickness ?? "—"}</td>
                      <td className="pr-2 text-right tabular-nums">{r.unit === "u" || r.unit === "forfait" ? r.qty : r.qty.toFixed(2)}</td>
                      <td className="pr-2">{r.unit}</td>
                      <td className="text-right tabular-nums">{r.puCents ? euros(r.totalCents) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold"><td colSpan={4} className="py-1">Total HT</td><td className="text-right tabular-nums text-primary">{euros(totalCents)}</td></tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Rappel : seules les longueurs réellement mesurées sont comptées. Rien n'est inventé.</p>
        </div>
      </div>
    </div>

    {/* Analyse automatique du plan (CDC §23-27) */}
    <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold">Analyse automatique du plan</p>
          <p className="text-sm text-muted-foreground">Détecte et regroupe toutes les désignations (DN, Ø, gaines, réseaux, +C) d'après le texte du plan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runAnalysis} variant="accent"><Search /> Analyser tout le plan</Button>
          {analysis && <Button onClick={autoDetectAll} variant="secondary"><Ruler /> Détecter toutes les longueurs</Button>}
        </div>
      </div>

      {/* Diagnostic : géométrie vectorielle disponible pour la détection auto */}
      {vectorCount !== null && (
        vectorCount === 0 ? (
          <div className="mt-3 rounded-[var(--radius-app)] border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="font-medium text-warning">Plan sans géométrie vectorielle (0 ligne trouvée)</p>
            <p className="mt-1 text-muted-foreground">
              Ce PDF est probablement un plan <strong>scanné (image)</strong> : il ne contient aucun tracé exploitable,
              donc la détection automatique des longueurs est impossible. Conformément au cahier des charges, aucune
              longueur n'est inventée — mesurez chaque réseau avec le bouton <strong>« Mesurer »</strong> (après avoir calibré l'échelle).
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">{vectorCount} lignes vectorielles trouvées dans le plan (utilisées pour la détection automatique).</p>
        )
      )}

      {analysis && (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {([["all", "Tout"], ["hydraulique", "Hydraulique"], ["aeraulique", "Aéraulique"], ["plusc", "Marqués +C"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setAnaFilter(k)} className={`rounded-full px-3 py-1 ${anaFilter === k ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"}`}>{l}</button>
            ))}
            <span className="ml-auto self-center text-xs text-muted-foreground">{analysis.reduce((s, r) => s + r.occurrences, 0)} désignations détectées · {analysis.length} dimensions</span>
          </div>

          {anaRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Aucune désignation détectée (le PDF n'est peut-être pas vectoriel, ou utilisez le mode manuel).</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-2 pr-3">Famille</th><th className="pr-3">Dimension</th><th className="pr-3">Réseau(x)</th><th className="pr-3 text-center">+C</th><th className="pr-3 text-right">Occur.</th><th className="pr-3">Longueur</th><th className="pr-3">Statut</th><th></th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {anaRows.map((r, i) => {
                    const dl = detectedLength(r.dimension);
                    return (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="py-2 pr-3">{r.famille === "hydraulique" ? "Hydraulique" : "Aéraulique"}</td>
                      <td className="pr-3 font-medium">{r.dimension}</td>
                      <td className="pr-3 text-muted-foreground">{r.reseaux.slice(0, 4).join(", ") || "—"}</td>
                      <td className="pr-3 text-center">{r.plusC > 0 ? <span className="text-accent">✓ {r.plusC}</span> : "—"}</td>
                      <td className="pr-3 text-right tabular-nums">{r.occurrences}</td>
                      <td className="pr-3 tabular-nums">{dl > 0 ? <span className="font-medium">{dl.toFixed(2)} m</span> : <span className="text-warning">à mesurer</span>}</td>
                      <td className="pr-3">{dl > 0 ? <Badge tone="warning">À vérifier</Badge> : <Badge tone="neutral">À mesurer</Badge>}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => autoDetectRow(r)} title="Détecter la longueur automatiquement">Détecter</Button>
                          <Button size="sm" variant="secondary" onClick={() => pickForMeasure(r)} title="Mesurer manuellement">Mesurer</Button>
                        </div>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            ⚠️ <strong>Détecter</strong> = l'outil cherche la ligne du plan la plus proche de chaque étiquette et calcule sa longueur (statut « À vérifier » — <strong>contrôlez le tracé surligné sur le plan</strong>, il peut se tromper). <strong>Mesurer</strong> = tracé manuel fiable. Le logiciel ne fabrique aucun mètre : s'il ne trouve pas de ligne proche, il laisse « à mesurer » (CDC §19/§29). Nécessite l'échelle calibrée.
          </p>
        </>
      )}
    </div>
    </div>
  );
}
