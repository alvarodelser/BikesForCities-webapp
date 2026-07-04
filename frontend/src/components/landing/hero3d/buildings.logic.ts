// Pure treadmill logic for the hero's building stream: spawn cadence,
// pulse trigger when a building passes the bike (x=0), pool recycling.
// The world scrolls toward -X; the bike is fixed at the origin.

export const SCROLL_SPEED = 7;    // world units / s
export const SPAWN_X = 48;        // buildings enter beyond the fog here
export const RECYCLE_X = -48;     // fully off-screen behind the camera
export const GAP_MIN = 3;
export const GAP_MAX = 10;
export const PULSE_MS = 600;
export const LANE_CLEARANCE = 4.5; // min |z| so buildings never touch the lane

export type BuildingKind = 'box' | 'slab' | 'tower' | 'stepped' | 'l';

export interface BuildingSpec {
  kind: BuildingKind;
  w: number; // footprint along X
  d: number; // footprint along Z
  h: number; // height
  z: number; // lateral offset (sign = side of the lane)
}

export function crossedBike(prevX: number, x: number): boolean {
  return prevX > 0 && x <= 0;
}

export function shouldRecycle(x: number): boolean {
  return x < RECYCLE_X;
}

export function nextGap(rng: () => number): number {
  return GAP_MIN + rng() * (GAP_MAX - GAP_MIN);
}

// Quick attack (25%), slow release (75%).
export function pulseIntensity(tMs: number): number {
  if (tMs < 0 || tMs >= PULSE_MS) return 0;
  const p = tMs / PULSE_MS;
  return p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
}

const range = (rng: () => number, lo: number, hi: number) =>
  lo + rng() * (hi - lo);

export function generateBuilding(
  rng: () => number,
  side: 1 | -1,
): BuildingSpec {
  const pick = rng();
  let kind: BuildingKind;
  if (pick < 0.3) kind = 'box';
  else if (pick < 0.5) kind = 'slab';
  else if (pick < 0.65) kind = 'tower';
  else if (pick < 0.85) kind = 'stepped';
  else kind = 'l';

  let w: number, d: number, h: number;
  switch (kind) {
    case 'box':     w = range(rng, 3, 5);   d = range(rng, 3, 5);   h = range(rng, 6, 14);  break;
    case 'slab':    w = range(rng, 6, 9);   d = range(rng, 2.5, 3.5); h = range(rng, 4, 8); break;
    case 'tower':   w = range(rng, 2, 3);   d = range(rng, 2, 3);   h = range(rng, 14, 22); break;
    case 'stepped': w = range(rng, 4, 6);   d = range(rng, 4, 6);   h = range(rng, 8, 16);  break;
    case 'l':       w = range(rng, 5, 7);   d = range(rng, 5, 7);   h = range(rng, 6, 12);  break;
  }

  const z = side * (LANE_CLEARANCE + rng() * 10);
  return { kind, w, d, h, z };
}
