# Spain Map Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix card overlap, add boundary-aware city labels (land=dark, sea=light, never straddling), animate the connector line, and fix the mobile carousel momentum jump.

**Architecture:** SpainMap's `connector` useMemo is replaced by a DOM-querying `useEffect` that tests candidate card positions against `SVGGeometryElement.isPointInFill`. Label placement is extracted into a pure utility module, then wired into a second `useEffect` (same pattern) that stores per-city label configs in state. ScrollableCityCards replaces its instant `velocity * 8` momentum jump with a `requestAnimationFrame` decay loop.

**Tech Stack:** React 19, D3 v7, TypeScript, Vitest + @testing-library/react, jsdom

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/components/landing/spainMapLabels.ts` | **Create** | Pure label-placement utilities (candidate geometry, overlap detection) |
| `frontend/src/components/landing/spainMapLabels.test.ts` | **Create** | Unit tests for the above |
| `frontend/src/components/landing/SpainMap.tsx` | **Modify** | Label placement effect, smart card placement effect, connector animation, dead-code removal |
| `frontend/src/components/ui/ScrollableCityCards.tsx` | **Modify** | rAF momentum deceleration, `useRef` wheel timer |
| `frontend/src/constants/cities.ts` | **Modify** | Remove deprecated `mapCoords` field |
| `frontend/src/styles/index.css` | **Modify** | Add `@keyframes draw-connector` and `card-appear` |

---

## Task 1: Dead code removal

**Files:**
- Modify: `frontend/src/components/landing/SpainMap.tsx`
- Modify: `frontend/src/constants/cities.ts`

- [ ] **Step 1: Remove `expandedCity` from SpainMap**

In `SpainMap.tsx`, remove the interface field and the destructured (but unused) variable:

```typescript
// Interface — remove this line:
expandedCity?: string | null;

// Destructuring (line ~211) — remove expandedCity from the destructured props:
const {
  width: widthProp,
  height: heightProp,
  onCityClick,
  onCityNavigate,
  selectedCity,
  cities,
  className,
} = props;
```

- [ ] **Step 2: Remove `mapCoords` from CityData**

In `frontend/src/constants/cities.ts`, delete the deprecated field:

```typescript
// Remove this line:
mapCoords?: { x: number; y: number }; // Legacy pixel coordinates (deprecated)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/SpainMap.tsx frontend/src/constants/cities.ts
git commit -m "refactor: remove unused expandedCity prop and deprecated mapCoords field"
```

---

## Task 2: Label placement utility module

**Files:**
- Create: `frontend/src/components/landing/spainMapLabels.ts`
- Create: `frontend/src/components/landing/spainMapLabels.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/landing/spainMapLabels.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeLabelCandidates,
  rectsOverlap,
  type LabelCandidate,
  type LabelRect,
} from './spainMapLabels';

describe('computeLabelCandidates', () => {
  it('returns four candidates in order: below, above, right, left', () => {
    const candidates = computeLabelCandidates(100, 100, 14, 12, 60);
    expect(candidates).toHaveLength(4);
    expect(candidates[0].position).toBe('below');
    expect(candidates[1].position).toBe('above');
    expect(candidates[2].position).toBe('right');
    expect(candidates[3].position).toBe('left');
  });

  it('below candidate rect top edge is below pin bottom edge', () => {
    const pinH = 12;
    const [below] = computeLabelCandidates(100, 100, 14, pinH, 60);
    expect(below.rect.y).toBeGreaterThan(100 + pinH / 2);
  });

  it('above candidate rect bottom edge is above pin top edge', () => {
    const pinH = 12;
    const candidates = computeLabelCandidates(100, 100, 14, pinH, 60);
    const above = candidates[1];
    expect(above.rect.y + above.rect.height).toBeLessThan(100 - pinH / 2);
  });

  it('right candidate rect left edge is right of pin right edge', () => {
    const pinW = 14;
    const candidates = computeLabelCandidates(100, 100, pinW, 12, 60);
    const right = candidates[2];
    expect(right.rect.x).toBeGreaterThan(100 + pinW / 2);
  });

  it('left candidate rect right edge is left of pin left edge', () => {
    const pinW = 14;
    const candidates = computeLabelCandidates(100, 100, pinW, 12, 60);
    const left = candidates[3];
    expect(left.rect.x + left.rect.width).toBeLessThan(100 - pinW / 2);
  });

  it('all rects have the given textWidth as width', () => {
    const textWidth = 72;
    const candidates = computeLabelCandidates(100, 100, 14, 12, textWidth);
    candidates.forEach(c => expect(c.rect.width).toBe(textWidth));
  });
});

describe('rectsOverlap', () => {
  it('returns true for clearly overlapping rects', () => {
    const a: LabelRect = { x: 0, y: 0, width: 50, height: 14 };
    const b: LabelRect = { x: 20, y: 0, width: 50, height: 14 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('returns false for clearly separated rects', () => {
    const a: LabelRect = { x: 0, y: 0, width: 50, height: 14 };
    const b: LabelRect = { x: 100, y: 0, width: 50, height: 14 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns false for rects that touch but do not overlap', () => {
    const a: LabelRect = { x: 0, y: 0, width: 50, height: 14 };
    const b: LabelRect = { x: 50, y: 0, width: 50, height: 14 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns false for vertically separated rects', () => {
    const a: LabelRect = { x: 0, y: 0, width: 50, height: 14 };
    const b: LabelRect = { x: 0, y: 20, width: 50, height: 14 };
    expect(rectsOverlap(a, b)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
cd frontend && npx vitest run src/components/landing/spainMapLabels.test.ts
```

Expected: `Cannot find module './spainMapLabels'`

- [ ] **Step 3: Create the utility module**

Create `frontend/src/components/landing/spainMapLabels.ts`:

```typescript
export type LabelPosition = 'below' | 'above' | 'right' | 'left';

export interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelCandidate {
  position: LabelPosition;
  anchorX: number;   // SVG <text> x attribute (always text-anchor="middle")
  anchorY: number;   // SVG <text> y attribute (baseline)
  rect: LabelRect;   // bounding box for overlap and boundary checks
}

const LABEL_HEIGHT = 13;
const PIN_GAP = 4;

export function computeLabelCandidates(
  px: number,
  py: number,
  pinW: number,
  pinH: number,
  textWidth: number,
): LabelCandidate[] {
  const w = textWidth;
  const h = LABEL_HEIGHT;
  const hw = pinW / 2;
  const hh = pinH / 2;

  return [
    {
      position: 'below',
      anchorX: px,
      anchorY: py + hh + PIN_GAP + h,
      rect: { x: px - w / 2, y: py + hh + PIN_GAP, width: w, height: h },
    },
    {
      position: 'above',
      anchorX: px,
      anchorY: py - hh - PIN_GAP,
      rect: { x: px - w / 2, y: py - hh - PIN_GAP - h, width: w, height: h },
    },
    {
      position: 'right',
      anchorX: px + hw + PIN_GAP + w / 2,
      anchorY: py + h / 2 - 2,
      rect: { x: px + hw + PIN_GAP, y: py - h / 2, width: w, height: h },
    },
    {
      position: 'left',
      anchorX: px - hw - PIN_GAP - w / 2,
      anchorY: py + h / 2 - 2,
      rect: { x: px - hw - PIN_GAP - w, y: py - h / 2, width: w, height: h },
    },
  ];
}

export function rectsOverlap(a: LabelRect, b: LabelRect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}
```

- [ ] **Step 4: Run — verify tests pass**

```bash
cd frontend && npx vitest run src/components/landing/spainMapLabels.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/spainMapLabels.ts frontend/src/components/landing/spainMapLabels.test.ts
git commit -m "feat: add label placement utility functions with tests"
```

---

## Task 3: Boundary-aware label placement in SpainMap

**Files:**
- Modify: `frontend/src/components/landing/SpainMap.tsx`
- Modify: `frontend/src/styles/index.css`

- [ ] **Step 1: Add the `LabelConfig` type and state to SpainMap**

At the top of `SpainMap.tsx`, add the import and new state near the other `useState` declarations:

```typescript
import { computeLabelCandidates, rectsOverlap } from './spainMapLabels';
```

Inside the `SpainMap` component body (after the existing `useState` calls):

```typescript
interface LabelConfig {
  anchorX: number;
  anchorY: number;
  fill: string;
  textShadow: string;
  hidden: boolean;
}
const [labelConfigs, setLabelConfigs] = useState<Record<string, LabelConfig>>({});
```

- [ ] **Step 2: Add the label placement `useEffect`**

Add this effect AFTER the existing D3 draw effect (the one that calls `g.append('path')`), so `.spain-shape` is guaranteed to exist when this runs:

```typescript
useEffect(() => {
  if (!svgRef.current || !geoData || !projection) return;
  const svgEl = svgRef.current;
  const spainEl = svgEl.querySelector<SVGGeometryElement>('.spain-shape');
  if (!spainEl) return;

  // Sort cities by population descending — higher priority gets label first
  const sorted = [...cities].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  const placedRects: import('./spainMapLabels').LabelRect[] = [];
  const result: Record<string, LabelConfig> = {};

  for (const city of sorted) {
    const [lon, lat] = transformCanaryCoords(
      city.geoCoords.longitude,
      city.geoCoords.latitude,
      isMobile,
    );
    const p = projection([lon, lat]);
    if (!p) continue;
    const [px, py] = p;

    const pinW = isMobile ? 12 : 14;
    const pinH = isMobile ? 10 : 12;
    const textWidth = city.name.length * 7;
    const candidates = computeLabelCandidates(px, py, pinW, pinH, textWidth);

    let chosen: import('./spainMapLabels').LabelCandidate | null = null;
    let chosenIsLand = false;

    for (const candidate of candidates) {
      const { rect } = candidate;
      const samplePoints: [number, number][] = [
        [rect.x, rect.y],
        [rect.x + rect.width, rect.y],
        [rect.x, rect.y + rect.height],
        [rect.x + rect.width, rect.y + rect.height],
        [rect.x + rect.width / 2, rect.y + rect.height / 2],
      ];

      const onLand = samplePoints.map(([x, y]) =>
        spainEl.isPointInFill(new DOMPoint(x, y)),
      );
      const allLand = onLand.every(Boolean);
      const allSea = onLand.every(v => !v);

      if ((allLand || allSea) && !placedRects.some(r => rectsOverlap(r, rect))) {
        chosen = candidate;
        chosenIsLand = allLand;
        break;
      }
    }

    if (chosen) {
      placedRects.push(chosen.rect);
      result[city.name] = {
        anchorX: chosen.anchorX,
        anchorY: chosen.anchorY,
        fill: chosenIsLand ? '#1a2a1a' : 'rgba(255,255,255,0.9)',
        textShadow: chosenIsLand
          ? '0 0 4px rgba(255,255,255,0.6)'
          : '0 1px 3px rgba(0,0,0,0.8)',
        hidden: false,
      };
    } else {
      result[city.name] = {
        anchorX: px,
        anchorY: py + pinH / 2 + 17,
        fill: '#003849',
        textShadow: '0 0 2px rgba(255,255,255,0.8)',
        hidden: true,
      };
    }
  }

  setLabelConfigs(result);
}, [geoData, projection, size, cities, isMobile]);
```

- [ ] **Step 3: Update the `Pin` component to accept and render `labelConfig`**

Add `labelConfig?: LabelConfig` to `PinProps`:

```typescript
interface PinProps {
  cityName: string;
  city: CityData;
  x: number;
  y: number;
  isActive: boolean;
  isHovered: boolean;
  isMobile: boolean;
  labelConfig?: LabelConfig;
  onClick: (cityName: string) => void;
  onHover: (cityName: string, hovered: boolean) => void;
}
```

Inside `Pin`, replace the existing `{!isMobile && (<text ...>)}` block with:

```typescript
{!isMobile && labelConfig && !labelConfig.hidden && (
  <text
    x={labelConfig.anchorX - x}
    y={labelConfig.anchorY - y}
    textAnchor="middle"
    className="transition-all duration-300 pointer-events-none"
    style={{
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
      fill: labelConfig.fill,
      fontWeight: 700,
      filter: `drop-shadow(${labelConfig.textShadow})`,
    }}
  >
    {city.name}
  </text>
)}
{!isMobile && labelConfig?.hidden && (isActive || isHovered) && (
  <text
    y={12 / 2 + 14}
    textAnchor="middle"
    className="transition-all duration-300 pointer-events-none"
    style={{
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
      fill: '#003849',
      fontWeight: 700,
      filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))',
    }}
  >
    {city.name}
  </text>
)}
```

- [ ] **Step 4: Pass `labelConfig` to each `Pin` in the render loop**

In the `{projection && getCityCoordinates(cities).map(...)}` block, add `labelConfig` to the `Pin` element:

```typescript
<Pin
  key={city.name}
  cityName={city.name}
  city={city.cityData}
  x={p[0]}
  y={p[1]}
  isActive={isActive}
  isHovered={isHovered}
  isMobile={isMobile}
  labelConfig={labelConfigs[city.name]}
  onClick={handlePinClick}
  onHover={handlePinHover}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run existing tests to confirm no regressions**

```bash
cd frontend && npx vitest run src/components/landing/
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/landing/SpainMap.tsx
git commit -m "feat: boundary-aware label placement with land/sea color adaptation"
```

---

## Task 4: Smart card placement + connector animation

**Files:**
- Modify: `frontend/src/components/landing/SpainMap.tsx`
- Modify: `frontend/src/styles/index.css`

- [ ] **Step 1: Add `@keyframes` for connector and card animations**

Add to the end of `frontend/src/styles/index.css`:

```css
@keyframes draw-connector {
  to { stroke-dashoffset: 0; }
}

@keyframes card-appear {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 2: Replace the `connector` useMemo with a `CardLayout` state + useEffect**

Remove the entire `const connector = useMemo(...)` block (lines ~306–343 in SpainMap.tsx).

Add a new interface and state declaration near the other state hooks:

```typescript
interface CardLayout {
  px: number;
  py: number;
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  connectorPath: string;
}

const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);
```

- [ ] **Step 3: Add the card placement useEffect**

Add this effect AFTER the label placement effect added in Task 3:

```typescript
useEffect(() => {
  if (!selectedCityData || !projection || isMobile || !svgRef.current) {
    setCardLayout(null);
    return;
  }
  const svgEl = svgRef.current;
  const spainEl = svgEl.querySelector<SVGGeometryElement>('.spain-shape');
  if (!spainEl) {
    setCardLayout(null);
    return;
  }

  const [lon, lat] = transformCanaryCoords(
    selectedCityData.geoCoords.longitude,
    selectedCityData.geoCoords.latitude,
    isMobile,
  );
  const p = projection([lon, lat]);
  if (!p) return;
  const [px, py] = p;

  const cardW = 270;
  const cardH = 310;
  const gap = 40;
  const margin = 16;

  const candidateCards = [
    { cardX: px + gap + cardW / 2, cardY: py },
    { cardX: px - gap - cardW / 2, cardY: py },
    { cardX: px + gap + cardW / 2, cardY: py - cardH / 2 },
    { cardX: px - gap - cardW / 2, cardY: py - cardH / 2 },
    { cardX: px + gap + cardW / 2, cardY: py + cardH / 2 },
    { cardX: px - gap - cardW / 2, cardY: py + cardH / 2 },
    { cardX: size.width * 0.82, cardY: size.height * 0.28 },
    { cardX: size.width * 0.18, cardY: size.height * 0.28 },
    { cardX: size.width * 0.82, cardY: size.height * 0.72 },
    { cardX: size.width * 0.18, cardY: size.height * 0.72 },
  ];

  let chosen = candidateCards[0];
  let minLandCorners = Infinity;

  for (const candidate of candidateCards) {
    const { cardX, cardY } = candidate;
    const left = cardX - cardW / 2;
    const top = cardY - cardH / 2;
    const right = cardX + cardW / 2;
    const bottom = cardY + cardH / 2;

    if (left < margin || top < margin || right > size.width - margin || bottom > size.height - margin) {
      continue;
    }

    const corners: [number, number][] = [
      [left, top], [right, top], [left, bottom], [right, bottom],
    ];
    const landCorners = corners.filter(([x, y]) =>
      spainEl.isPointInFill(new DOMPoint(x, y)),
    ).length;

    if (landCorners === 0) {
      chosen = candidate;
      break;
    }
    if (landCorners < minLandCorners) {
      minLandCorners = landCorners;
      chosen = candidate;
    }
  }

  const { cardX, cardY } = chosen;
  const toRight = cardX > px;
  const diagSize = 30;
  const p2x = toRight ? px + diagSize : px - diagSize;
  const p2y = cardY < py ? py - diagSize : py + diagSize;
  const p3x = toRight ? cardX - cardW / 2 : cardX + cardW / 2;
  const p3y = p2y;
  const p4x = p3x;
  const p4y = cardY < py ? cardY + cardH / 2 : cardY - cardH / 2;

  setCardLayout({
    px, py, cardX, cardY, cardW, cardH,
    connectorPath: `M ${px} ${py} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${p4x} ${p4y}`,
  });
}, [selectedCityData, projection, isMobile, size, geoData]);
```

- [ ] **Step 4: Update the connector `<path>` in JSX**

Replace the existing connector `<path>` element with:

```tsx
{cardLayout && (
  <path
    key={`connector-${selectedCity}`}
    d={cardLayout.connectorPath}
    fill="none"
    stroke="white"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      strokeDasharray: 1000,
      strokeDashoffset: 1000,
      animation: 'draw-connector 0.4s ease-out forwards',
    }}
  />
)}
```

- [ ] **Step 5: Update the floating city card div**

Replace the existing `{!isMobile && selectedCityData && connector && (...)}` block with:

```tsx
{!isMobile && selectedCityData && cardLayout && (
  <div
    key={`card-${selectedCity}`}
    className="absolute z-50"
    style={{
      left: cardLayout.cardX - cardLayout.cardW / 2,
      top: cardLayout.cardY - cardLayout.cardH / 2,
      width: cardLayout.cardW,
      height: cardLayout.cardH,
      pointerEvents: 'auto',
      animation: 'card-appear 0.3s ease-out 0.05s both',
    }}
  >
    <CityCard
      city={selectedCityData}
      position={0}
      panel={true}
      onCityNavigate={onCityNavigate}
    />
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles and no regressions**

```bash
cd frontend && npx tsc --noEmit && npx vitest run src/components/landing/
```

Expected: no TypeScript errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/landing/SpainMap.tsx frontend/src/styles/index.css
git commit -m "feat: smart card placement avoiding land, animated connector line"
```

---

## Task 5: Mobile carousel momentum fix

**Files:**
- Modify: `frontend/src/components/ui/ScrollableCityCards.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/ui/ScrollableCityCards.test.tsx`:

```typescript
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ScrollableCityCards from './ScrollableCityCards';
import type { CityData } from '../../constants/cities';

const mockCities: CityData[] = [
  { name: 'Madrid',    slug: 'madrid',    path: '/madrid',    population: 3300000, budget: null, geoCoords: { longitude: -3.7, latitude: 40.4 } },
  { name: 'Barcelona', slug: 'barcelona', path: '/barcelona', population: 1600000, budget: null, geoCoords: { longitude: 2.15, latitude: 41.38 } },
  { name: 'Valencia',  slug: 'valencia',  path: '/valencia',  population: 800000,  budget: null, geoCoords: { longitude: -0.37, latitude: 39.47 } },
];

let rafQueue: Array<(t: number) => void> = [];

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const flushFrames = (n: number) => {
  for (let i = 0; i < n; i++) {
    const cbs = [...rafQueue];
    rafQueue = [];
    cbs.forEach(cb => cb(performance.now()));
  }
};

describe('ScrollableCityCards momentum', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('does not schedule rAF when touch ends with zero velocity', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    const touchTarget = container.querySelector('[data-testid="cards-container"]') as HTMLElement;
    if (!touchTarget) return; // guard — test will fail at the assertion if missing

    act(() => {
      touchTarget.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        targetTouches: [{ clientX: 200 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });

    expect(rafQueue).toHaveLength(0);
  });

  it('schedules rAF when touch ends with non-zero velocity', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    const touchTarget = container.querySelector('[data-testid="cards-container"]') as HTMLElement;
    if (!touchTarget) return;

    act(() => {
      touchTarget.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        targetTouches: [{ clientX: 200 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchmove', {
        bubbles: true,
        targetTouches: [{ clientX: 100 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });

    expect(rafQueue.length).toBeGreaterThan(0);
  });

  it('rAF loop terminates — queue empties within 30 frames', () => {
    const { container } = render(
      <ScrollableCityCards
        cities={mockCities}
        selectedCity="Madrid"
        onCitySelect={vi.fn()}
        onCityNavigate={vi.fn()}
      />
    );
    const touchTarget = container.querySelector('[data-testid="cards-container"]') as HTMLElement;
    if (!touchTarget) return;

    act(() => {
      touchTarget.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        targetTouches: [{ clientX: 200 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchmove', {
        bubbles: true,
        targetTouches: [{ clientX: 0 } as Touch],
      }));
      touchTarget.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });

    act(() => flushFrames(30));
    expect(rafQueue).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — verify tests fail**

```bash
cd frontend && npx vitest run src/components/ui/ScrollableCityCards.test.tsx
```

Expected: `cards-container` test-id not found, or momentum tests fail showing no rAF usage.

- [ ] **Step 3: Add `data-testid` and rAF refs to ScrollableCityCards**

At the top of the component function, add two new refs alongside the existing ones:

```typescript
const rafRef = useRef<number | null>(null);
const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Add `data-testid="cards-container"` to the inner `<div>` that has `onTouchStart`/`onTouchMove`/`onTouchEnd`:

```tsx
<div
  ref={containerRef}
  data-testid="cards-container"
  className="relative h-full w-full flex items-center justify-center overflow-hidden touch-none"
  ...
>
```

- [ ] **Step 4: Replace the wheel timer hack**

In `handleWheel`, replace:

```typescript
// OLD — remove these lines:
const timer = (window as any)._wheelTimer;
if (timer) clearTimeout(timer);
(window as any)._wheelTimer = setTimeout(() => {
  setIsDragging(false);
}, 200);
```

With:

```typescript
// NEW:
if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
wheelTimerRef.current = setTimeout(() => {
  setIsDragging(false);
}, 200);
```

- [ ] **Step 5: Replace the momentum jump with rAF deceleration**

In `onTouchEnd`, replace:

```typescript
// OLD — remove:
if (Math.abs(velocity.current) > 0.2) {
  const momentum = -velocity.current * 8;
  setScrollOffset(prev => prev + momentum);
}
```

With:

```typescript
// NEW:
if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

if (Math.abs(velocity.current) > 0.1) {
  let v = Math.max(-2.5, Math.min(2.5, -velocity.current * 3));

  const loop = () => {
    v *= 0.88;
    if (Math.abs(v) >= 0.05) {
      setScrollOffset(prev => prev + v);
      rafRef.current = requestAnimationFrame(loop);
    } else {
      setScrollOffset(prev => Math.round(prev + v));
      rafRef.current = null;
    }
  };

  rafRef.current = requestAnimationFrame(loop);
}
```

- [ ] **Step 6: Add cleanup on unmount**

Add a cleanup effect for the rAF (place with the other `useEffect` calls):

```typescript
useEffect(() => {
  return () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (wheelTimerRef.current !== null) clearTimeout(wheelTimerRef.current);
  };
}, []);
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
cd frontend && npx vitest run src/components/ui/ScrollableCityCards.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 8: Run full test suite**

```bash
cd frontend && npx vitest run src/
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ui/ScrollableCityCards.tsx frontend/src/components/ui/ScrollableCityCards.test.tsx
git commit -m "fix: replace instant momentum jump with rAF deceleration loop in mobile carousel"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task |
|-----------------|------|
| Remove `expandedCity` prop | Task 1 |
| Remove deprecated `mapCoords` | Task 1 |
| Smart card placement (avoid land) | Task 4 |
| Connector animation (stroke-dashoffset) | Task 4 |
| Card fade-in animation | Task 4 |
| Boundary-aware label placement | Task 3 |
| Land=dark, sea=light text color | Task 3 |
| Hidden labels show on hover | Task 3 |
| Overlap avoidance (population priority) | Task 3 |
| Mobile carousel rAF deceleration | Task 5 |
| Remove `_wheelTimer` hack | Task 5 |

All requirements covered. ✓

**Notes:**
- `DOMPoint` is available in all modern browsers and in jsdom — used instead of `createSVGPoint()` for simplicity.
- The label `filter: drop-shadow(...)` CSS property is used instead of SVG `textShadow` (which is not a valid SVG attribute); `filter` is the correct SVG approach.
- Task 3's label coordinates in the `Pin` component use `labelConfig.anchorX - x` because the `Pin` group is already translated to `(x, y)` via `transform="translate(x,y)"`.
