// Extraction de la géométrie vectorielle d'une page PDF (lignes/polylignes),
// en coordonnées « viewport » (mêmes pixels que le canvas de rendu).
// OPS pdfjs : save 10, restore 11, transform 12, moveTo 13, lineTo 14,
// curveTo 15, closePath 18, rectangle 19, constructPath 91.

type Mat = [number, number, number, number, number, number];
type Pt = { x: number; y: number };
export type Polyline = { points: Pt[] };

const ID: Mat = [1, 0, 0, 1, 0, 0];

function mul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function apply(m: Mat, x: number, y: number): Pt {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

type Viewport = { convertToViewportPoint: (x: number, y: number) => number[] };

/**
 * Reconstruit les polylignes d'une page à partir de son operator list.
 * Les courbes de Bézier sont approximées par leur point d'arrivée (suffisant
 * pour des réseaux CVC majoritairement orthogonaux).
 */
export function extractPolylines(
  opList: { fnArray: number[]; argsArray: unknown[] },
  viewport: Viewport,
  OPS: Record<string, number>,
): Polyline[] {
  const polylines: Polyline[] = [];
  let ctm: Mat = ID;
  const stack: Mat[] = [];

  const toVp = (x: number, y: number): Pt => {
    const p = apply(ctm, x, y);
    const v = viewport.convertToViewportPoint(p.x, p.y);
    return { x: v[0], y: v[1] };
  };

  for (let k = 0; k < opList.fnArray.length; k++) {
    const fn = opList.fnArray[k];
    const a = opList.argsArray[k] as unknown;
    if (fn === OPS.save) { stack.push(ctm); }
    else if (fn === OPS.restore) { ctm = stack.pop() ?? ID; }
    else if (fn === OPS.transform) {
      const m = a as number[];
      ctm = mul(ctm, [m[0], m[1], m[2], m[3], m[4], m[5]]);
    } else if (fn === OPS.constructPath) {
      const [ops, args] = a as [number[], number[]];
      let j = 0;
      let cur: Pt[] = [];
      const flush = () => { if (cur.length >= 2) polylines.push({ points: cur }); cur = []; };
      for (let i = 0; i < ops.length; i++) {
        switch (ops[i] | 0) {
          case OPS.moveTo: flush(); cur = [toVp(args[j], args[j + 1])]; j += 2; break;
          case OPS.lineTo: cur.push(toVp(args[j], args[j + 1])); j += 2; break;
          case OPS.curveTo: cur.push(toVp(args[j + 4], args[j + 5])); j += 6; break;
          case OPS.curveTo2: cur.push(toVp(args[j + 2], args[j + 3])); j += 4; break;
          case OPS.curveTo3: cur.push(toVp(args[j + 2], args[j + 3])); j += 4; break;
          case OPS.rectangle: {
            flush();
            const x = args[j], y = args[j + 1], w = args[j + 2], h = args[j + 3]; j += 4;
            cur = [toVp(x, y), toVp(x + w, y), toVp(x + w, y + h), toVp(x, y + h), toVp(x, y)];
            flush();
            break;
          }
          case OPS.closePath: if (cur.length >= 2) cur.push(cur[0]); break;
        }
      }
      flush();
    }
  }
  return polylines;
}

export function polyLenPx(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

/** Distance d'un point à un segment [a,b]. */
function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance minimale d'un point à une polyligne. */
export function distToPolyline(p: Pt, poly: Pt[]): number {
  let m = Infinity;
  for (let i = 1; i < poly.length; i++) m = Math.min(m, distToSeg(p, poly[i - 1], poly[i]));
  return m;
}
