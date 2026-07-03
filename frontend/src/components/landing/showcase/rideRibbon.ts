/**
 * Geometry for the ride-ribbon ranking graphic.
 *
 * A winding "route" line descends the canvas; below it hangs a curtain of
 * vertically offset copies, occlusion-culled so at any x only the stroke
 * from the nearest line section above survives (no crosshatch where the
 * route doubles back). Ported from frontend/prototypes/ride_ribbon_gen.py.
 */

export interface Pt {
  x: number;
  y: number;
}

type Cubic = [Pt, Pt, Pt, Pt];

const p = (x: number, y: number): Pt => ({ x, y });

// Main route: starts top-right, hooks left, bulges right, calm slope to
// bottom-left. Each entry is one cubic (p0, c1, c2, p1).
export const SEGS: Cubic[] = [
  [p(400, 90), p(370, 135), p(330, 175), p(280, 208)],
  [p(280, 208), p(230, 240), p(155, 235), p(152, 265)],
  [p(152, 265), p(150, 295), p(235, 302), p(285, 332)],
  [p(285, 332), p(330, 360), p(330, 395), p(365, 425)],
  [p(365, 425), p(400, 452), p(430, 460), p(427, 490)],
  [p(427, 490), p(423, 520), p(370, 525), p(352, 555)],
  [p(352, 555), p(335, 583), p(355, 600), p(350, 630)],
  [p(350, 630), p(342, 670), p(290, 690), p(235, 710)],
  [p(235, 710), p(185, 728), p(130, 738), p(95, 748)],
];

export const PATH_TOP_Y = SEGS[0][0].y;
export const PATH_BOTTOM_Y = SEGS[SEGS.length - 1][3].y;

// Altitude gradient, top -> bottom.
export const PALETTE: [number, string][] = [
  [0.0, '#EDBB43'],
  [0.14, '#EE6055'],
  [0.32, '#BE3A38'],
  [0.5, '#C2379B'],
  [0.66, '#8A1FC8'],
  [0.84, '#2823D6'],
  [1.0, '#171655'],
];

const N = 48; // samples per cubic; keeps x-gaps under the occlusion bin window
const W = 20; // index window treated as "same branch" when looking for occluders
const DY = 8; // curtain stroke spacing
const MAX_DY = 768;
const GAP = 3; // stop strokes this far above the occluding branch

function cubicAt([p0, c1, c2, p1]: Cubic, t: number): Pt {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * p1.x,
    y: mt ** 3 * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * p1.y,
  };
}

export function samplePath(): Pt[] {
  const pts: Pt[] = [];
  SEGS.forEach((seg, si) => {
    for (let k = si === 0 ? 0 : 1; k <= N; k++) {
      pts.push(cubicAt(seg, k / N));
    }
  });
  return pts;
}

export interface CurtainStep {
  dy: number;
  runs: Pt[][];
}

export function curtainSteps(pts: Pt[]): CurtainStep[] {
  const bins = new Map<number, { y: number; i: number }[]>();
  pts.forEach(({ x, y }, i) => {
    const bin = Math.floor(x);
    if (!bins.has(bin)) bins.set(bin, []);
    bins.get(bin)!.push({ y, i });
  });

  // For each sample, the y of the nearest other branch directly below it.
  const nextBelow = pts.map(({ x, y }, i) => {
    let best = Infinity;
    const bin = Math.floor(x);
    for (let b = bin - 2; b <= bin + 2; b++) {
      for (const { y: yj, i: j } of bins.get(b) ?? []) {
        if (yj > y + 4 && Math.abs(j - i) > W && yj < best) best = yj;
      }
    }
    return best;
  });

  const steps: CurtainStep[] = [];
  for (let dy = DY; dy <= MAX_DY; dy += DY) {
    const runs: Pt[][] = [];
    let run: Pt[] = [];
    pts.forEach(({ x, y }, i) => {
      if (y + dy < nextBelow[i] - GAP) {
        run.push({ x, y: y + dy });
      } else {
        if (run.length > 1) runs.push(run);
        run = [];
      }
    });
    if (run.length > 1) runs.push(run);
    if (runs.length > 0) steps.push({ dy, runs });
  }
  return steps;
}

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

export function polyD(run: Pt[]): string {
  return 'M' + run.map(({ x, y }) => `${fmt(x)} ${fmt(y)}`).join('L');
}

export function mainPathD(): string {
  return (
    `M ${SEGS[0][0].x} ${SEGS[0][0].y} ` +
    SEGS.map(([, c1, c2, p1]) => `C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p1.x} ${p1.y}`).join(' ')
  );
}

function nearestIndexAtY(pts: Pt[], y: number): number {
  let idx = 0;
  let bestDist = Infinity;
  pts.forEach((pt, i) => {
    const d = Math.abs(pt.y - y);
    if (d < bestDist) {
      bestDist = d;
      idx = i;
    }
  });
  return idx;
}

/** Nearest point on the sampled path for a given y (the path is monotonic in y). */
export function pointAtY(pts: Pt[], y: number): Pt {
  return pts[nearestIndexAtY(pts, y)];
}

export interface PathHit {
  point: Pt;
  /** Tangent angle in degrees, facing "forward" toward the start of pts
      (the ribbon's best/top end) — i.e. the uphill direction. Computed
      from the true local tangent, so it stays correct even where the path
      momentarily reverses left-right (it isn't inferred from x order). */
  angleDeg: number;
}

/** Like pointAtY, but also returns the path's local uphill-facing tangent. */
export function pathHitAtY(pts: Pt[], y: number): PathHit {
  const idx = nearestIndexAtY(pts, y);
  const prev = pts[Math.max(0, idx - 1)];
  const next = pts[Math.min(pts.length - 1, idx + 1)];
  // toward the start of the array = toward better scores = "uphill"
  const dx = prev.x - next.x;
  const dy = prev.y - next.y;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { point: pts[idx], angleDeg };
}

/** Linear score → path y: min score at the bottom, max score at the top. */
export function yForScore(score: number, min: number, max: number): number {
  if (max <= min) return (PATH_TOP_Y + PATH_BOTTOM_Y) / 2;
  const t = (score - min) / (max - min);
  return PATH_BOTTOM_Y - t * (PATH_BOTTOM_Y - PATH_TOP_Y);
}

/** k items spread evenly across arr, always keeping the first and last. */
export function sampleSpread<T>(arr: T[], k: number): T[] {
  if (arr.length <= k) return [...arr];
  const picked: T[] = [];
  for (let i = 0; i < k; i++) {
    picked.push(arr[Math.round((i * (arr.length - 1)) / (k - 1))]);
  }
  return picked;
}

/**
 * k items picked at random from items, always keeping the highest- and
 * lowest-scoring ones so the ribbon keeps spanning the true min/max range.
 * Non-deterministic by design — call once per mount so the sample varies
 * across visits without reshuffling on every re-render.
 */
export function sampleRandomWithExtremes<T>(
  items: T[],
  k: number,
  scoreOf: (item: T) => number,
): T[] {
  if (items.length <= k) return [...items];
  const sorted = [...items].sort((a, b) => scoreOf(b) - scoreOf(a));
  const max = sorted[0];
  const min = sorted[sorted.length - 1];
  const middle = sorted.slice(1, -1);
  for (let i = middle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }
  const picked = middle.slice(0, Math.max(0, k - 2));
  return [max, ...picked, min].sort((a, b) => scoreOf(b) - scoreOf(a));
}

// Vertical extent the <linearGradient id="rr-altitude"> is painted over
// (matches its y1/y2 in RideRibbonRanking); colorAtY must track it so a
// score number reads the same hue the path shows at that height.
export const GRADIENT_Y0 = 80;
export const GRADIENT_Y1 = 820;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The altitude gradient's color at a given canvas y (clamped to its ends). */
export function colorAtY(y: number): string {
  const t = Math.min(1, Math.max(0, (y - GRADIENT_Y0) / (GRADIENT_Y1 - GRADIENT_Y0)));
  let lo = PALETTE[0];
  let hi = PALETTE[PALETTE.length - 1];
  for (let i = 0; i < PALETTE.length - 1; i++) {
    if (t >= PALETTE[i][0] && t <= PALETTE[i + 1][0]) {
      lo = PALETTE[i];
      hi = PALETTE[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const localT = (t - lo[0]) / span;
  const [r0, g0, b0] = hexToRgb(lo[1]);
  const [r1, g1, b1] = hexToRgb(hi[1]);
  const r = Math.round(r0 + (r1 - r0) * localT);
  const g = Math.round(g0 + (g1 - g0) * localT);
  const b = Math.round(b0 + (b1 - b0) * localT);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Darkens an "rgb(r, g, b)" string by a 0–1 fraction, clamped at black. */
export function darkenColor(rgb: string, amount: number): string {
  const m = rgb.match(/\d+/g)!.map(Number);
  const d = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  return `rgb(${d(m[0])}, ${d(m[1])}, ${d(m[2])})`;
}

/**
 * Declutters a list of naturally-ordered y positions (ascending) so
 * consecutive labels keep at least minGap between them, moving each label
 * as little as possible from its natural position. Two-pass greedy: push
 * down on overlap, then push back up from the bottom if that ran past
 * maxY.
 */
export function resolveLabelPositions(
  naturalYs: number[],
  minGap: number,
  minY: number,
  maxY: number,
): number[] {
  if (naturalYs.length === 0) return [];
  const ys = naturalYs.map(y => Math.min(maxY, Math.max(minY, y)));
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] - ys[i - 1] < minGap) ys[i] = ys[i - 1] + minGap;
  }
  if (ys[ys.length - 1] > maxY) {
    ys[ys.length - 1] = maxY;
    for (let i = ys.length - 2; i >= 0; i--) {
      if (ys[i + 1] - ys[i] < minGap) ys[i] = ys[i + 1] - minGap;
    }
  }
  return ys;
}
