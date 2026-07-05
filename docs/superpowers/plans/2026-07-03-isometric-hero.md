# Isometric WebGL Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LandingReveal intro overlay and current hero visuals with a permanent Three.js isometric scene: the B4C bike logo draws itself, falls with physics onto a reflective red bike lane, and rides forever while glass buildings stream past and pulse green.

**Architecture:** Plain Three.js (no react-three-fiber) mounted in a rewritten `HeroSection`. Pure logic (descent physics, building spawn/pulse) lives in WebGL-free modules with vitest coverage; WebGL modules (`scene`, `bike`, `lane`, `buildings`) consume them. `RevealContext` is kept — `HeroSection` provides it and flips `revealed` when the bike touches down.

**Tech Stack:** React 19, TypeScript, three@0.180 (already a dependency), vitest 3, Tailwind + CSS vars from `frontend/src/styles/theme.css`.

**Spec:** `docs/superpowers/specs/2026-07-03-isometric-hero-design.md`

## Global Constraints

- No new npm dependencies. `three@^0.180.0` and `@types/three@^0.180.0` are already installed.
- All new source under `frontend/src/components/landing/hero3d/`.
- Run tests from `frontend/`: `npx vitest run src/components/landing/hero3d/<file>.test.ts`
- Typecheck/build from `frontend/`: `npm run build` (runs `tsc -b && vite build`). Lint: `npm run lint`.
- Palette anchors from `theme.css`: `--red` #AF4749, `--green-dark` #027A76, `--blue-dark` #003849, `--cream` #FBF6EF.
- Renderer pixel ratio capped at 2. Bloom is the only post-processing pass.
- `prefers-reduced-motion: reduce` → single static render, no RAF loop. WebGL unavailable → `HeroPoster` DOM fallback.
- `AnimatedB4CLogo.tsx` must NOT be deleted (poster fallback uses it). `LandingReveal.tsx` IS deleted.
- Descent intro plays on every load — no sessionStorage gating.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Descent physics (pure module, TDD)

**Files:**
- Create: `frontend/src/components/landing/hero3d/physics.ts`
- Test: `frontend/src/components/landing/hero3d/physics.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DescentState { y, vy, bounces, done }`, `createDescent(startY: number): DescentState`, `stepDescent(s: DescentState, dt: number, groundY: number): DescentState`, constants `GRAVITY`, `RESTITUTION`, `REST_SPEED`. Task 4 (`bike.ts`) calls `createDescent`/`stepDescent` with `dt` in **seconds**.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/components/landing/hero3d/physics.test.ts
import { describe, it, expect } from 'vitest';
import { createDescent, stepDescent, RESTITUTION } from './physics';

const GROUND = 0;

describe('descent physics', () => {
  it('falls: velocity goes negative and height drops', () => {
    const s0 = createDescent(20);
    const s1 = stepDescent(s0, 0.1, GROUND);
    expect(s1.vy).toBeLessThan(0);
    expect(s1.y).toBeLessThan(s0.y);
    expect(s1.done).toBe(false);
  });

  it('bounces on ground contact with reduced speed', () => {
    const falling = { y: 0.1, vy: -20, bounces: 0, done: false };
    const s = stepDescent(falling, 0.05, GROUND);
    expect(s.y).toBe(GROUND);
    expect(s.vy).toBeGreaterThan(0);          // moving up again
    expect(s.vy).toBeLessThan(20 * RESTITUTION * 1.1); // energy lost
    expect(s.bounces).toBe(1);
  });

  it('settles instead of bouncing when impact is slow', () => {
    const slow = { y: 0.01, vy: -1, bounces: 2, done: false };
    const s = stepDescent(slow, 0.05, GROUND);
    expect(s.done).toBe(true);
    expect(s.y).toBe(GROUND);
    expect(s.vy).toBe(0);
  });

  it('a full drop from height comes to rest within 10 simulated seconds', () => {
    let s = createDescent(20);
    let t = 0;
    while (!s.done && t < 10) {
      s = stepDescent(s, 1 / 60, GROUND);
      t += 1 / 60;
    }
    expect(s.done).toBe(true);
    expect(s.y).toBe(GROUND);
    expect(s.bounces).toBeGreaterThanOrEqual(1);
  });

  it('is inert after done', () => {
    const rest = { y: GROUND, vy: 0, bounces: 3, done: true };
    expect(stepDescent(rest, 0.5, GROUND)).toEqual(rest);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npx vitest run src/components/landing/hero3d/physics.test.ts`
Expected: FAIL — cannot resolve `./physics`.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/landing/hero3d/physics.ts
// Gravity descent with decaying bounces for the hero bike intro.
// Units: world units and seconds (Three.js scene scale).

export interface DescentState {
  y: number;
  vy: number;
  bounces: number;
  done: boolean;
}

export const GRAVITY = -60;      // world units / s²
export const RESTITUTION = 0.38; // fraction of speed kept per bounce
export const REST_SPEED = 2.0;   // impacts slower than this settle

export function createDescent(startY: number): DescentState {
  return { y: startY, vy: 0, bounces: 0, done: false };
}

export function stepDescent(
  s: DescentState,
  dt: number,
  groundY: number,
): DescentState {
  if (s.done) return s;
  const vyFall = s.vy + GRAVITY * dt;
  const yNext = s.y + vyFall * dt;
  if (yNext > groundY) {
    return { y: yNext, vy: vyFall, bounces: s.bounces, done: false };
  }
  if (Math.abs(vyFall) < REST_SPEED) {
    return { y: groundY, vy: 0, bounces: s.bounces, done: true };
  }
  return {
    y: groundY,
    vy: -vyFall * RESTITUTION,
    bounces: s.bounces + 1,
    done: false,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/landing/hero3d/physics.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/hero3d/physics.ts frontend/src/components/landing/hero3d/physics.test.ts
git commit -m "feat(hero3d): descent physics with decaying bounces

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Building spawn/pulse logic (pure module, TDD)

**Files:**
- Create: `frontend/src/components/landing/hero3d/buildings.logic.ts`
- Test: `frontend/src/components/landing/hero3d/buildings.logic.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 6 `buildings.ts`):
  - `type BuildingKind = 'box' | 'slab' | 'tower' | 'stepped' | 'l'`
  - `interface BuildingSpec { kind: BuildingKind; w: number; d: number; h: number; z: number }`
  - `generateBuilding(rng: () => number, side: 1 | -1): BuildingSpec` — `rng` returns [0,1); `side` +1 = behind lane, −1 = in front.
  - `nextGap(rng: () => number): number`
  - `crossedBike(prevX: number, x: number): boolean`
  - `shouldRecycle(x: number): boolean`
  - `pulseIntensity(tMs: number): number` — 0..1 envelope, 0 outside [0, PULSE_MS).
  - Constants: `SCROLL_SPEED` (units/s), `SPAWN_X`, `RECYCLE_X`, `GAP_MIN`, `GAP_MAX`, `PULSE_MS`, `LANE_CLEARANCE`.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/components/landing/hero3d/buildings.logic.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateBuilding, nextGap, crossedBike, shouldRecycle, pulseIntensity,
  GAP_MIN, GAP_MAX, PULSE_MS, RECYCLE_X, LANE_CLEARANCE,
  type BuildingKind,
} from './buildings.logic';

// Deterministic rng from a fixed sequence, cycling.
const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('crossedBike', () => {
  it('fires exactly when a building crosses x=0 moving backwards', () => {
    expect(crossedBike(0.1, -0.1)).toBe(true);
    expect(crossedBike(5, 1)).toBe(false);    // still ahead
    expect(crossedBike(-1, -2)).toBe(false);  // already behind
    expect(crossedBike(0, -1)).toBe(false);   // was already at/behind bike
  });
});

describe('shouldRecycle', () => {
  it('recycles only past the recycle line', () => {
    expect(shouldRecycle(RECYCLE_X - 1)).toBe(true);
    expect(shouldRecycle(RECYCLE_X + 1)).toBe(false);
  });
});

describe('pulseIntensity', () => {
  it('is zero outside the pulse window', () => {
    expect(pulseIntensity(-1)).toBe(0);
    expect(pulseIntensity(PULSE_MS)).toBe(0);
    expect(pulseIntensity(PULSE_MS + 500)).toBe(0);
  });
  it('rises to a peak then decays', () => {
    const peak = pulseIntensity(PULSE_MS * 0.25);
    expect(peak).toBeCloseTo(1);
    expect(pulseIntensity(PULSE_MS * 0.05)).toBeLessThan(peak);
    expect(pulseIntensity(PULSE_MS * 0.9)).toBeLessThan(peak);
  });
});

describe('nextGap', () => {
  it('stays within [GAP_MIN, GAP_MAX]', () => {
    expect(nextGap(() => 0)).toBe(GAP_MIN);
    expect(nextGap(() => 0.999999)).toBeLessThanOrEqual(GAP_MAX);
    expect(nextGap(() => 0.5)).toBeGreaterThan(GAP_MIN);
  });
});

describe('generateBuilding', () => {
  it('keeps buildings clear of the lane on the requested side', () => {
    for (const r of [0, 0.3, 0.7, 0.99]) {
      const behind = generateBuilding(seq([r, r, r, r, r]), 1);
      const front = generateBuilding(seq([r, r, r, r, r]), -1);
      expect(behind.z).toBeGreaterThanOrEqual(LANE_CLEARANCE);
      expect(front.z).toBeLessThanOrEqual(-LANE_CLEARANCE);
    }
  });

  it('produces sane positive dimensions', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const b = generateBuilding(seq([r, r, r, r, r]), 1);
      expect(b.w).toBeGreaterThan(0);
      expect(b.d).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
      expect(b.h).toBeLessThan(30);
    }
  });

  it('reaches every silhouette kind across the rng range', () => {
    const kinds = new Set<BuildingKind>();
    for (let i = 0; i < 200; i++) {
      const r = i / 200;
      kinds.add(generateBuilding(seq([r, 0.5, 0.5, 0.5, 0.5]), 1).kind);
    }
    expect(kinds).toEqual(new Set(['box', 'slab', 'tower', 'stepped', 'l']));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/landing/hero3d/buildings.logic.test.ts`
Expected: FAIL — cannot resolve `./buildings.logic`.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/landing/hero3d/buildings.logic.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/landing/hero3d/buildings.logic.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/hero3d/buildings.logic.ts frontend/src/components/landing/hero3d/buildings.logic.test.ts
git commit -m "feat(hero3d): building spawn, pulse and recycle logic

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Palette + stage (renderer, isometric camera, bloom)

**Files:**
- Create: `frontend/src/components/landing/hero3d/palette.ts`
- Create: `frontend/src/components/landing/hero3d/scene.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `palette.ts`: string hex constants `BG`, `GROUND`, `LANE_RED`, `LANE_RED_DEEP`, `BIKE_CREAM`, `GLASS_TEAL`, `GLASS_EMISSIVE`, `PULSE_GREEN`, `SETTLED_GREEN`.
  - `scene.ts`: `createStage(canvas: HTMLCanvasElement, width: number, height: number): HeroStage` where `HeroStage = { renderer, scene, camera, resize(w, h), render(), dispose() }` (`camera: THREE.OrthographicCamera`). `render()` runs the composer (bloom included). Tasks 4–7 add objects to `stage.scene` and call `stage.render()`.

No unit test — WebGL contexts don't exist in jsdom. Verified by typecheck now and visually in Task 9.

- [ ] **Step 1: Write palette**

```ts
// frontend/src/components/landing/hero3d/palette.ts
// Scene palette anchored on theme.css tokens, darkened for the night scene.

export const BG = '#052e2b';           // near-black teal (reference backdrop)
export const GROUND = '#06393a';
export const LANE_RED = '#b23a3d';     // --red brightened toward crimson
export const LANE_RED_DEEP = '#7d2b2e';
export const BIKE_CREAM = '#FBF6EF';   // --cream
export const GLASS_TEAL = '#0f5f5c';
export const GLASS_EMISSIVE = '#0a4f4c';
export const PULSE_GREEN = '#27c48f';  // flash when passing the bike
export const SETTLED_GREEN = '#0f6b52'; // permanent tint after the pulse
```

- [ ] **Step 2: Write the stage**

```ts
// frontend/src/components/landing/hero3d/scene.ts
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BG, GROUND } from './palette';

export interface HeroStage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  resize: (w: number, h: number) => void;
  render: () => void;
  dispose: () => void;
}

const FRUSTUM = 16; // half-height of the ortho frustum, world units

export function createStage(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): HeroStage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 38, 85);

  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(
    -FRUSTUM * aspect, FRUSTUM * aspect, FRUSTUM, -FRUSTUM, 0.1, 300,
  );
  camera.position.set(40, 40, 40); // classic isometric: X reads as the diagonal
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight('#9fd8cf', 0.7));
  const dir = new THREE.DirectionalLight('#eafff5', 1.1);
  dir.position.set(30, 50, 20);
  scene.add(dir);

  // Ground plane, large enough to fill the frustum out to the fog.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: GROUND, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.85, // strength
    0.5,  // radius
    0.55, // threshold — cream bike and green pulses cross it, glass does not
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = (w: number, h: number) => {
    const a = w / h;
    camera.left = -FRUSTUM * a;
    camera.right = FRUSTUM * a;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
  };

  return {
    renderer,
    scene,
    camera,
    resize,
    render: () => composer.render(),
    dispose: () => {
      composer.dispose();
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 3: Typecheck**

Run (from `frontend/`): `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/hero3d/palette.ts frontend/src/components/landing/hero3d/scene.ts
git commit -m "feat(hero3d): palette and isometric stage with bloom

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Bike — stroke-draw texture + physics descent

**Files:**
- Create: `frontend/src/components/landing/hero3d/bikePaths.ts`
- Create: `frontend/src/components/landing/hero3d/bike.ts`

**Interfaces:**
- Consumes: `createDescent`, `stepDescent` from `./physics` (Task 1); `BIKE_CREAM` from `./palette` (Task 3).
- Produces: `createBike(camera: THREE.Camera): BikeRig` where
  `BikeRig = { mesh: THREE.Mesh; update(elapsedMs: number, dtSec: number): void; landed(): boolean; settleNow(): void }`.
  `landed()` becomes true at the FIRST ground contact (bounce or settle) — Task 7 uses it to trigger the lane and flip `revealed`. `settleNow()` jumps straight to the resting pose (reduced-motion path). Exported constant `BIKE_REST_Y`.

The path data is copied verbatim from `AnimatedB4CLogo.tsx` (same viewBox 210×297, same stagger delays), so the in-scene draw matches the brand animation.

- [ ] **Step 1: Write the path data module**

```ts
// frontend/src/components/landing/hero3d/bikePaths.ts
// B4C logo geometry, copied from AnimatedB4CLogo.tsx (viewBox 210x297).
// delay = when each element starts drawing, ms; strokes draw over STROKE_MS.

export const VIEWBOX = { w: 210, h: 297 };
export const STROKE_MS = 550;
export const DRAW_TOTAL_MS = 1590; // last stroke: 1040ms delay + 550ms draw

export type BikeElement =
  | { kind: 'circle'; cx: number; cy: number; r: number; width: number; delay: number }
  | { kind: 'path'; d: string; width: number; delay: number }
  | { kind: 'fill'; d: string; delay: number };

export const BIKE_ELEMENTS: BikeElement[] = [
  // Wheels
  { kind: 'circle', cx: 51.57188, cy: 239.64207, r: 31.599552, width: 10.2759, delay: 0 },
  { kind: 'circle', cx: 156.01056, cy: 186.93922, r: 31.599552, width: 10.2759, delay: 120 },
  // Frame
  { kind: 'path', d: 'm 50.846601,236.49926 13.054839,-53.18638 50.28529,-26.10967 14.02187,14.98889 c 0,0 12.57132,13.05484 27.56021,12.57132', width: 10.2759, delay: 240 },
  { kind: 'path', d: 'm 57.615774,177.02723 43.999646,44.48314 16.92292,-61.40608', width: 10.2759, delay: 340 },
  { kind: 'path', d: 'M 50.363097,237.46628 101.1319,221.99388', width: 10.2759, delay: 420 },
  { kind: 'path', d: 'm 104.03298,146.80769 11.6043,11.84606', width: 10.2759, delay: 460 },
  { kind: 'path', d: 'm 83.725453,143.66485 15.472397,-7.49444 c 0,0 9.42849,-0.96702 5.80215,12.32959', width: 10.2759, delay: 500 },
  // Handlebar / fork
  { kind: 'path', d: 'M 40.191901,59.994455 101.34225,137.33773 74.243549,60.246923', width: 6.42242, delay: 560 },
  { kind: 'path', d: 'M 129.99901,60.228186 102.79279,135.88719', width: 6.42242, delay: 620 },
  { kind: 'path', d: 'm 74.243549,60.246923 c 0,0 1.422686,-31.062096 27.340451,-45.237861', width: 6.42242, delay: 680 },
  { kind: 'path', d: 'm 129.99901,60.228186 c 0,0 -1.67437,-32.886906 -27.83793,-45.219124', width: 6.42242, delay: 720 },
  { kind: 'path', d: 'm 164.56397,59.74112 -61.5942,77.35629', width: 6.42242, delay: 760 },
  // Saddle (filled)
  { kind: 'fill', d: 'm 54.19147,180.87018 c -2.010069,-1.91387 -6.180102,-0.55439 -7.793595,-0.15447 0,0 -10.706602,-0.38971 -5.502575,-6.06523 14.806373,-16.14787 28.224485,-14.54298 24.4,-10.49742 -5.722553,6.05332 -3.886711,9.40213 -3.886711,9.40213 z', delay: 820 },
  // Rim arcs
  { kind: 'path', d: 'm 39.181097,59.74112 c 0,0 7.029138,-43.88701 62.661403,-44.607939', width: 10.2759, delay: 840 },
  { kind: 'path', d: 'm 164.05066,59.975718 c 0,0 -18.09574,9.197451 -34.05165,0.252468', width: 10.2759, delay: 880 },
  { kind: 'path', d: 'm 129.99901,60.228186 c 0,0 -9.89623,7.952301 -28.29457,7.484755', width: 10.2759, delay: 920 },
  { kind: 'path', d: 'm 164.56397,59.74112 c 0,0 -7.02912,-43.88701 -62.66139,-44.607939', width: 10.2759, delay: 960 },
  { kind: 'path', d: 'm 40.191901,59.994455 c 0,0 18.09574,9.19745 34.051648,0.252468', width: 10.2759, delay: 1000 },
  { kind: 'path', d: 'm 74.243549,60.246923 c 0,0 10.451862,7.913889 28.850221,7.446337', width: 10.2759, delay: 1040 },
];
```

- [ ] **Step 2: Write the bike rig**

```ts
// frontend/src/components/landing/hero3d/bike.ts
import * as THREE from 'three';
import {
  BIKE_ELEMENTS, VIEWBOX, STROKE_MS, DRAW_TOTAL_MS, type BikeElement,
} from './bikePaths';
import { createDescent, stepDescent, type DescentState } from './physics';
import { BIKE_CREAM } from './palette';

const TEX_W = 512;
const TEX_H = Math.round((TEX_W * VIEWBOX.h) / VIEWBOX.w); // 724
const PLANE_H = 9; // world units
const PLANE_W = PLANE_H * (VIEWBOX.w / VIEWBOX.h);
export const BIKE_REST_Y = PLANE_H * 0.42; // wheels kiss the ground plane
const START_Y = BIKE_REST_Y + 14;
const SQUASH_MS = 240;

// Measure an SVG path via a detached DOM path element (once, at init).
function pathLength(d: string): number {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', d);
  return el.getTotalLength();
}

interface Drawable {
  el: BikeElement;
  path2d: Path2D;
  length: number; // 0 for fills
}

export interface BikeRig {
  mesh: THREE.Mesh;
  update: (elapsedMs: number, dtSec: number) => void;
  landed: () => boolean;
  settleNow: () => void;
}

export function createBike(camera: THREE.Camera): BikeRig {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;

  const drawables: Drawable[] = BIKE_ELEMENTS.map((el) => {
    if (el.kind === 'circle') {
      const p = new Path2D();
      p.arc(el.cx, el.cy, el.r, 0, Math.PI * 2);
      return { el, path2d: p, length: 2 * Math.PI * el.r };
    }
    return {
      el,
      path2d: new Path2D(el.d),
      length: el.kind === 'path' ? pathLength(el.d) : 0,
    };
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  material.toneMapped = false; // keep cream at full brightness so bloom catches it

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PLANE_W, PLANE_H),
    material,
  );
  // Billboard: parallel to the screen, upright — flat-logo look of the reference.
  mesh.quaternion.copy(camera.quaternion);
  mesh.position.set(0, START_Y, 0);

  const scale = TEX_W / VIEWBOX.w;
  let drawnUpTo = -1; // last elapsedMs rendered into the texture

  function drawFrame(tMs: number) {
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = BIKE_CREAM;
    ctx.fillStyle = BIKE_CREAM;
    for (const { el, path2d, length } of drawables) {
      const local = tMs - el.delay;
      if (local <= 0) continue;
      if (el.kind === 'fill') {
        ctx.globalAlpha = Math.min(local / 300, 1);
        ctx.fill(path2d);
        ctx.globalAlpha = 1;
        continue;
      }
      const p = Math.min(local / STROKE_MS, 1);
      ctx.lineWidth = el.width;
      ctx.setLineDash([length * p, length]);
      ctx.stroke(path2d);
    }
    ctx.restore();
    texture.needsUpdate = true;
  }

  let descent: DescentState | null = null;
  let hasLanded = false;
  let squashT = -1; // ms since last impact, -1 = idle
  let prevBounces = 0;

  function applySquash(dtMs: number) {
    if (squashT < 0) return;
    squashT += dtMs;
    if (squashT >= SQUASH_MS) {
      squashT = -1;
      mesh.scale.set(1, 1, 1);
      return;
    }
    const k = Math.sin((Math.PI * squashT) / SQUASH_MS);
    mesh.scale.set(1 + 0.08 * k, 1 - 0.12 * k, 1);
  }

  return {
    mesh,

    update(elapsedMs, dtSec) {
      // Phase 1: stroke draw, floating high with a slow bob.
      if (elapsedMs < DRAW_TOTAL_MS) {
        drawFrame(elapsedMs);
        drawnUpTo = elapsedMs;
        mesh.position.y = START_Y + Math.sin(elapsedMs / 500) * 0.4;
        return;
      }
      if (drawnUpTo < DRAW_TOTAL_MS) {
        drawFrame(DRAW_TOTAL_MS); // final complete frame
        drawnUpTo = DRAW_TOTAL_MS;
      }
      // Phase 2: physics descent.
      if (!descent) descent = createDescent(mesh.position.y);
      if (!descent.done) {
        descent = stepDescent(descent, dtSec, BIKE_REST_Y);
        mesh.position.y = descent.y;
        if (!hasLanded && (descent.bounces > 0 || descent.done)) {
          hasLanded = true;
          squashT = 0;
        } else if (descent.bounces > prevBounces) {
          squashT = 0;
        }
        prevBounces = descent.bounces;
      }
      applySquash(dtSec * 1000);
    },

    landed: () => hasLanded,

    settleNow() {
      drawFrame(DRAW_TOTAL_MS);
      drawnUpTo = DRAW_TOTAL_MS;
      descent = { y: BIKE_REST_Y, vy: 0, bounces: 1, done: true };
      hasLanded = true;
      mesh.position.y = BIKE_REST_Y;
      mesh.scale.set(1, 1, 1);
    },
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/hero3d/bikePaths.ts frontend/src/components/landing/hero3d/bike.ts
git commit -m "feat(hero3d): bike rig with canvas stroke-draw and physics descent

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Lane — reflective strip, landing ring, self-painting edge

**Files:**
- Create: `frontend/src/components/landing/hero3d/lane.ts`

**Interfaces:**
- Consumes: `LANE_RED`, `LANE_RED_DEEP` from `./palette`.
- Produces: `createLane(): LaneRig` where
  `LaneRig = { group: THREE.Group; trigger(): void; update(dtMs: number): void; settleNow(): void }`.
  `trigger()` is called once at touchdown: plays the ring ripple and grows the lane out from the bike. `settleNow()` jumps to the final state. The lane's leading edge is FIXED at `x = LANE_AHEAD` (in front of the bike at the origin) — the world scrolls, the edge doesn't, which creates the "painting the lane just ahead of itself" illusion. Exported constant `LANE_WIDTH`.

- [ ] **Step 1: Implement**

```ts
// frontend/src/components/landing/hero3d/lane.ts
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { LANE_RED, LANE_RED_DEEP } from './palette';

export const LANE_WIDTH = 3.4;
export const LANE_AHEAD = 6;    // leading edge, world units in front of the bike
export const LANE_BEHIND = 70;  // stretches back into the fog

const GROW_MS = 800;
const RING_MS = 900;

export interface LaneRig {
  group: THREE.Group;
  trigger: () => void;
  update: (dtMs: number) => void;
  settleNow: () => void;
}

export function createLane(): LaneRig {
  const group = new THREE.Group();
  const length = LANE_AHEAD + LANE_BEHIND;
  const centerX = (LANE_AHEAD - LANE_BEHIND) / 2;

  // Mirror strip — the wet-paint reflection of the glowing bike.
  const reflector = new Reflector(
    new THREE.PlaneGeometry(length, LANE_WIDTH),
    {
      color: LANE_RED_DEEP, // tints the mirror so it reads as paint, not glass
      textureWidth: 1024,
      textureHeight: 256,
      clipBias: 0.003,
    },
  );
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(centerX, 0.01, 0);
  group.add(reflector);

  // Translucent red wash on top: dims the mirror into "wet paint".
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(length, LANE_WIDTH),
    new THREE.MeshBasicMaterial({
      color: LANE_RED,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  wash.rotation.x = -Math.PI / 2;
  wash.position.set(centerX, 0.02, 0);
  group.add(wash);

  // Landing ring ripple.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 1.0, 48),
    new THREE.MeshBasicMaterial({
      color: LANE_RED,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.03, 0);
  group.add(ring);

  // Lane grows outward from the bike (group origin is at x=0, the bike).
  group.scale.x = 0.001;
  group.visible = false;

  let growT = -1; // ms since trigger, -1 = not yet triggered
  const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

  return {
    group,

    trigger() {
      if (growT >= 0) return;
      growT = 0;
      group.visible = true;
    },

    update(dtMs) {
      if (growT < 0) return;
      growT += dtMs;
      const gp = Math.min(growT / GROW_MS, 1);
      group.scale.x = Math.max(easeOut(gp), 0.001);
      const rp = Math.min(growT / RING_MS, 1);
      const ringMat = ring.material as THREE.MeshBasicMaterial;
      if (rp < 1) {
        ring.scale.setScalar(1 + rp * 8);
        ringMat.opacity = 0.9 * (1 - rp);
      } else {
        ringMat.opacity = 0;
      }
    },

    settleNow() {
      growT = GROW_MS + RING_MS;
      group.visible = true;
      group.scale.x = 1;
      (ring.material as THREE.MeshBasicMaterial).opacity = 0;
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/hero3d/lane.ts
git commit -m "feat(hero3d): reflective red lane with landing ring ripple

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Buildings — glass pool, treadmill, green pulses

**Files:**
- Create: `frontend/src/components/landing/hero3d/buildings.ts`

**Interfaces:**
- Consumes (from `./buildings.logic`): `generateBuilding`, `nextGap`, `crossedBike`, `shouldRecycle`, `pulseIntensity`, `SCROLL_SPEED`, `SPAWN_X`, `RECYCLE_X`, `PULSE_MS`, `BuildingSpec`. From `./palette`: `GLASS_TEAL`, `GLASS_EMISSIVE`, `PULSE_GREEN`, `SETTLED_GREEN`.
- Produces: `createBuildings(rng?: () => number): BuildingsRig` where
  `BuildingsRig = { group: THREE.Group; update(dtMs: number, running: boolean): void }`.
  `running=false` freezes the treadmill (pre-touchdown); the prefilled skyline still renders. Buildings already behind the bike at init start in the settled-green state, as if the bike had already passed them.

- [ ] **Step 1: Implement**

```ts
// frontend/src/components/landing/hero3d/buildings.ts
import * as THREE from 'three';
import {
  generateBuilding, nextGap, crossedBike, shouldRecycle, pulseIntensity,
  SCROLL_SPEED, SPAWN_X, RECYCLE_X, PULSE_MS, type BuildingSpec,
} from './buildings.logic';
import { GLASS_TEAL, GLASS_EMISSIVE, PULSE_GREEN, SETTLED_GREEN } from './palette';

const POOL_SIZE = 26;
const BASE_EMISSIVE = 0.35;
const PULSE_EMISSIVE_BOOST = 2.2;

const teal = new THREE.Color(GLASS_TEAL);
const settledGreen = new THREE.Color(SETTLED_GREEN);
const emissiveTeal = new THREE.Color(GLASS_EMISSIVE);
const pulseGreen = new THREE.Color(PULSE_GREEN);

interface Slot {
  root: THREE.Group;
  material: THREE.MeshPhysicalMaterial;
  x: number;
  pulseT: number; // ms since pulse start; -1 = idle
  settled: boolean;
}

export interface BuildingsRig {
  group: THREE.Group;
  update: (dtMs: number, running: boolean) => void;
}

function makeGlassMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: teal.clone(),
    emissive: emissiveTeal.clone(),
    emissiveIntensity: BASE_EMISSIVE,
    roughness: 0.45,   // frosted / diffusive
    metalness: 0,
    transmission: 0.55, // refractive glass
    thickness: 2,
    transparent: true,
    opacity: 0.92,
  });
}

// Builds the silhouette for a spec: 1 box for simple kinds,
// 2 boxes for 'stepped' (setback tower) and 'l' (L-footprint).
function buildSilhouette(spec: BuildingSpec, material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    g.add(m);
  };
  switch (spec.kind) {
    case 'stepped':
      add(spec.w, spec.h * 0.55, spec.d, 0, spec.h * 0.275, 0);
      add(spec.w * 0.6, spec.h, spec.d * 0.6, 0, spec.h * 0.5, 0);
      break;
    case 'l':
      add(spec.w, spec.h, spec.d * 0.45, 0, spec.h * 0.5, -spec.d * 0.275);
      add(spec.w * 0.45, spec.h * 0.8, spec.d, -spec.w * 0.275, spec.h * 0.4, 0);
      break;
    default:
      add(spec.w, spec.h, spec.d, 0, spec.h * 0.5, 0);
  }
  g.position.z = spec.z;
  return g;
}

function applyAppearance(slot: Slot) {
  const flash = slot.pulseT >= 0 ? pulseIntensity(slot.pulseT) : 0;
  const base = slot.settled ? settledGreen : teal;
  slot.material.color.copy(base).lerp(pulseGreen, flash * 0.6);
  slot.material.emissive
    .copy(slot.settled ? settledGreen : emissiveTeal)
    .lerp(pulseGreen, flash);
  slot.material.emissiveIntensity = BASE_EMISSIVE + flash * PULSE_EMISSIVE_BOOST;
}

export function createBuildings(rng: () => number = Math.random): BuildingsRig {
  const group = new THREE.Group();
  const slots: Slot[] = [];

  function populate(slot: Slot, x: number) {
    slot.root.clear();
    const side: 1 | -1 = rng() < 0.6 ? 1 : -1; // bias behind the lane, like the reference
    const spec = generateBuilding(rng, side);
    const silhouette = buildSilhouette(spec, slot.material);
    slot.root.add(silhouette);
    slot.root.position.x = x;
    slot.x = x;
    slot.pulseT = -1;
    slot.settled = x <= 0; // already passed at init → already green
    applyAppearance(slot);
  }

  // Prefill the whole corridor so the skyline exists from frame one.
  let cursor = RECYCLE_X + 4;
  for (let i = 0; i < POOL_SIZE; i++) {
    const material = makeGlassMaterial();
    const root = new THREE.Group();
    group.add(root);
    const slot: Slot = { root, material, x: 0, pulseT: -1, settled: false };
    slots.push(slot);
    populate(slot, cursor);
    cursor += nextGap(rng);
    if (cursor > SPAWN_X) cursor = RECYCLE_X + 4 + rng() * 2;
  }

  return {
    group,

    update(dtMs, running) {
      // Pulses only start while running, and running never reverts to false,
      // so a frozen treadmill has nothing to animate.
      if (!running) return;
      const dx = SCROLL_SPEED * (dtMs / 1000);
      let headX = Math.max(...slots.map((s) => s.x));
      for (const slot of slots) {
        const prevX = slot.x;
        slot.x -= dx;
        slot.root.position.x = slot.x;

        if (crossedBike(prevX, slot.x)) slot.pulseT = 0;
        if (slot.pulseT >= 0) {
          slot.pulseT += dtMs;
          if (slot.pulseT >= PULSE_MS) {
            slot.pulseT = -1;
            slot.settled = true;
          }
          applyAppearance(slot);
        }

        if (shouldRecycle(slot.x)) {
          headX += nextGap(rng);
          populate(slot, headX);
        }
      }
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/hero3d/buildings.ts
git commit -m "feat(hero3d): pooled glass buildings with green pass-by pulses

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: HeroScene wrapper + HeroPoster fallback

**Files:**
- Create: `frontend/src/components/landing/hero3d/HeroScene.tsx`
- Create: `frontend/src/components/landing/hero3d/HeroPoster.tsx`

**Interfaces:**
- Consumes: `createStage` (Task 3), `createBike` (Task 4), `createLane` (Task 5), `createBuildings` (Task 6), `AnimatedB4CLogo` (existing), `BG`, `LANE_RED` from `./palette`.
- Produces: `HeroScene: React.FC<{ onLanded: () => void }>` — fills its parent (absolute inset-0). Calls `onLanded` exactly once: at bike touchdown, or immediately on the reduced-motion/poster paths. Task 8 renders it inside the rewritten `HeroSection`.

- [ ] **Step 1: Write the poster fallback**

```tsx
// frontend/src/components/landing/hero3d/HeroPoster.tsx
// Static DOM fallback when WebGL is unavailable: dark backdrop,
// red diagonal band, the brand bike on top.
import React from 'react';
import AnimatedB4CLogo from '../AnimatedB4CLogo';
import { BG, LANE_RED } from './palette';

const HeroPoster: React.FC = () => (
  <div
    aria-hidden
    className="absolute inset-0 overflow-hidden"
    style={{ background: `radial-gradient(ellipse 80% 70% at 50% 40%, #0a4540 0%, ${BG} 70%)` }}
  >
    <div
      className="absolute"
      style={{
        left: '-20%',
        top: '58%',
        width: '140%',
        height: 'clamp(48px, 9vw, 110px)',
        background: LANE_RED,
        transform: 'rotate(-16deg)',
        boxShadow: `0 0 60px 10px ${LANE_RED}55`,
      }}
    />
    <AnimatedB4CLogo
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 'clamp(90px, 14vw, 160px)',
        transform: 'translate(-50%, -60%)',
        color: 'var(--cream)',
      }}
    />
  </div>
);

export default HeroPoster;
```

- [ ] **Step 2: Write the scene wrapper**

```tsx
// frontend/src/components/landing/hero3d/HeroScene.tsx
import React, { useEffect, useRef, useState } from 'react';
import { createStage } from './scene';
import { createBike } from './bike';
import { createLane } from './lane';
import { createBuildings } from './buildings';
import HeroPoster from './HeroPoster';

interface Props {
  onLanded: () => void;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const HeroScene: React.FC<Props> = ({ onLanded }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;
  const [poster, setPoster] = useState(false);

  useEffect(() => {
    if (!webglAvailable()) {
      setPoster(true);
      onLandedRef.current();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const { clientWidth: w, clientHeight: h } = parent;

    const stage = createStage(canvas, w, h);
    const bike = createBike(stage.camera);
    const lane = createLane();
    const buildings = createBuildings();
    stage.scene.add(bike.mesh, lane.group, buildings.group);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      bike.settleNow();
      lane.settleNow();
      buildings.update(16, true); // one tick so appearances apply
      stage.render();
      onLandedRef.current();
      return () => stage.dispose();
    }

    let raf = 0;
    let paused = false;
    let running = false; // treadmill on after touchdown
    let last = performance.now();
    const start = last;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dtMs = Math.min(now - last, 100); // clamp tab-switch jumps
      last = now;
      if (paused) return;

      bike.update(now - start, dtMs / 1000);
      if (!running && bike.landed()) {
        running = true;
        lane.trigger();
        onLandedRef.current();
      }
      lane.update(dtMs);
      buildings.update(dtMs, running);
      stage.render();
    };
    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      paused = document.hidden || offscreen;
    };
    let offscreen = false;
    const io = new IntersectionObserver(([entry]) => {
      offscreen = !entry.isIntersecting;
      paused = document.hidden || offscreen;
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);

    const ro = new ResizeObserver(() => {
      stage.resize(parent.clientWidth, parent.clientHeight);
    });
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      stage.dispose();
    };
  }, []);

  if (poster) return <HeroPoster />;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
    />
  );
};

export default HeroScene;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/hero3d/HeroScene.tsx frontend/src/components/landing/hero3d/HeroPoster.tsx
git commit -m "feat(hero3d): HeroScene orchestrator with reduced-motion and poster fallbacks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire into HeroSection, drop LandingReveal

**Files:**
- Modify: `frontend/src/components/landing/HeroSection.tsx` (full rewrite)
- Modify: `frontend/src/pages/LandingPage.tsx` (remove `LandingReveal` wrapper)
- Delete: `frontend/src/components/landing/LandingReveal.tsx`

**Interfaces:**
- Consumes: `HeroScene` (Task 7), existing `RevealContext` from `frontend/src/contexts/RevealContext.tsx` (unchanged).
- Produces: `HeroSection` now PROVIDES `RevealContext` itself (it was the only consumer of `revealed`; the provider moves here from the deleted `LandingReveal`). Headline/CTA keep their existing reveal transitions, colors flipped to cream-on-dark.

- [ ] **Step 1: Rewrite HeroSection**

```tsx
// frontend/src/components/landing/HeroSection.tsx
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { RevealContext } from '../../contexts/RevealContext';
import HeroScene from './hero3d/HeroScene';

const DUR = 480;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const [revealed, setRevealed] = useState(false);
  const onLanded = useCallback(() => setRevealed(true), []);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <RevealContext.Provider value={{ revealed }}>
      <section
        className="w-full relative overflow-hidden"
        style={{ background: '#052e2b', minHeight: 'min(88vh, 900px)' }}
      >
        <HeroScene onLanded={onLanded} />

        {/* Subtle vignette so scene edges fall off into the dark */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 90% 80% at 50% 45%, transparent 55%, rgba(0,0,0,0.35) 100%)',
          }}
        />

        {/* Text overlay — weighted left; scene action sits center-right */}
        <div className="relative z-10 w-full max-w-[var(--container-max)] mx-auto px-[var(--space-gutter)] pb-14 pt-[calc(var(--navbar-height,80px)+3rem)] md:py-24 pointer-events-none">
          <h1
            className="font-heading font-bold max-w-[12ch]"
            style={{
              fontSize: 'clamp(3.2rem, 6vw, 6.5rem)',
              letterSpacing: '-0.03em',
              lineHeight: 0.92,
              color: 'var(--cream)',
              clipPath: revealed ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
              opacity: revealed ? 1 : 0,
              transition: prefersReduced
                ? `opacity ${DUR}ms ${EASE}`
                : `clip-path ${DUR + 200}ms ${EASE}, opacity ${DUR}ms ${EASE}`,
            }}
          >
            Bikes for Cities
          </h1>

          <div
            aria-hidden
            style={{
              height: '1px',
              background: 'rgba(251,246,239,0.25)',
              margin: '1.5rem 0',
              maxWidth: '38rem',
              transformOrigin: 'left',
              transform: revealed ? 'scaleX(1)' : 'scaleX(0)',
              transition: prefersReduced
                ? undefined
                : `transform ${DUR + 100}ms ${EASE} 180ms`,
            }}
          />

          <div
            className="flex items-center gap-6 flex-wrap pointer-events-auto"
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(8px)',
              transition: prefersReduced
                ? `opacity ${DUR}ms ${EASE} 360ms`
                : `opacity ${DUR}ms ${EASE} 360ms, transform ${DUR}ms ${EASE} 360ms`,
            }}
          >
            <p
              className="font-heading"
              style={{
                fontSize: '1rem',
                color: 'var(--cream)',
                opacity: 0.65,
                letterSpacing: '0.01em',
              }}
            >
              Infraestructura ciclista · 20+ ciudades españolas
            </p>
            <button
              onClick={() => navigate('/compare')}
              className="group flex items-center gap-3 transition-transform duration-200 hover:-translate-y-[2px] active:scale-[0.98] focus:outline-none"
              style={{
                background: 'var(--cream)',
                color: 'var(--blue-dark)',
                borderRadius: '999px',
                padding: '0.8rem 1.9rem',
                fontSize: '1rem',
                fontFamily: 'var(--heading)',
                fontWeight: 600,
                letterSpacing: '0.01em',
                boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              }}
            >
              Explorar ciudades
              <ArrowRight
                size={16}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </button>
          </div>
        </div>
      </section>
    </RevealContext.Provider>
  );
};

export default HeroSection;
```

- [ ] **Step 2: Update LandingPage and delete LandingReveal**

```tsx
// frontend/src/pages/LandingPage.tsx
import React from 'react';

import HeroSection from '../components/landing/HeroSection';
import MapSelector from '../components/landing/MapSelector';
import DataShowcaseSection from '../components/landing/DataShowcaseSection';
import GetInvolvedSection, { FaqSection } from '../components/landing/GetInvolvedSection';

const LandingPage: React.FC = () => {
  return (
    <div className="overflow-x-hidden">
      <HeroSection />
      <MapSelector />
      <DataShowcaseSection />
      <GetInvolvedSection />
      <FaqSection />
    </div>
  );
};

export default LandingPage;
```

```bash
git rm frontend/src/components/landing/LandingReveal.tsx
```

- [ ] **Step 3: Confirm nothing else imports LandingReveal**

Run: `grep -rn "LandingReveal" frontend/src`
Expected: no matches.

- [ ] **Step 4: Typecheck and full test suite**

Run: `npx tsc -b && npx vitest run`
Expected: build clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/components/landing/HeroSection.tsx frontend/src/pages/LandingPage.tsx frontend/src/components/landing/LandingReveal.tsx
git commit -m "feat(landing): isometric WebGL hero replaces LandingReveal intro

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Verification — lint, build, visual pass

**Files:** none created; fixes applied where found.

- [ ] **Step 1: Lint and production build**

Run (from `frontend/`): `npm run lint && npm run build`
Expected: both clean. Fix any errors surfaced (unused imports, types) and amend the previous commit if trivial.

- [ ] **Step 2: Visual verification with Playwright**

Start the dev server (`npm run dev`, background). With the Playwright browser tools:
1. Navigate to `http://localhost:5173` — screenshot at ~1s (bike drawing/falling), at ~3s (landed, lane grown, treadmill running), at ~10s (buildings pulsing green as they pass).
2. Check: bike centered and glowing; red lane diagonal with visible bike reflection; leading edge fixed ahead of the bike; buildings streaming, pulsing green at the bike, staying green behind it; headline/CTA composed after touchdown; no console errors.
3. Emulate `prefers-reduced-motion: reduce` (via `browser_run_code_unsafe` CDP or launching with the emulation flag) — verify a static settled frame renders and the headline is visible.
4. Resize viewport to 390×844 (mobile) — scene fills, text legible, no horizontal scroll.

- [ ] **Step 3: Tune to taste**

Bloom strength/threshold, `SCROLL_SPEED`, fog distances, and lane opacity are the expected tuning knobs. Adjust in place if the screenshots look off (washed-out bloom → raise threshold to ~0.7; buildings too dim → raise `emissiveIntensity` base).

- [ ] **Step 4: Final commit**

```bash
git add -A frontend/src
git commit -m "polish(hero3d): visual tuning after Playwright verification

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
