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

/** Nearest point on the sampled path for a given y (the path is monotonic in y). */
export function pointAtY(pts: Pt[], y: number): Pt {
  let best = pts[0];
  let bestDist = Infinity;
  for (const pt of pts) {
    const d = Math.abs(pt.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = pt;
    }
  }
  return best;
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
