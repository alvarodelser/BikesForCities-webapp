# Forum Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/forum` page with a static bird's-eye city building SVG background, glassmorphism news cards, animated dark-green trajectory paths that trigger building pop animations, and a proportional naked-rail timeline.

**Architecture:** A `CityBuildingBackground` forwardRef component fetches building GeoJSON once on mount, projects geo-coordinates into a fixed 1000×700 SVG viewport, and exposes `triggerPop` imperatively. A `BuildingTrajectories` component renders three staggered animated paths on a matching SVG overlay and calls `triggerPop` with nearby building IDs at each animation midpoint. `NewsTimeline` drops its sidebar panel and uses a proportional thumb. `NewsCard` gets glassmorphism styles.

**Tech Stack:** React 19, TypeScript, Vitest + jsdom, Tailwind v4, `/api/cities/{id}/features/geojson` endpoint

---

## File Map

**New files:**
- `frontend/src/components/forum/CityBuildingBackground.tsx` — fetches buildings GeoJSON, projects to SVG, exposes triggerPop handle
- `frontend/src/components/forum/BuildingTrajectories.tsx` — three animated SVG paths + proximity pop trigger
- `frontend/src/utils/geoProjection.ts` — pure geo→SVG coordinate projection
- `frontend/src/utils/buildingProximity.ts` — pure function: path sample points × building bboxes → nearby IDs
- `frontend/src/utils/geoProjection.test.ts` — tests for projection
- `frontend/src/utils/buildingProximity.test.ts` — tests for proximity detection

**Modified files:**
- `frontend/src/components/forum/NewsCard.tsx` — glassmorphism styles
- `frontend/src/components/forum/NewsTimeline.tsx` — naked rail, proportional thumb
- `frontend/src/pages/ForumPage.tsx` — background layers, city selection, glassmorphism header
- `frontend/src/styles/theme.css` — forum CSS custom properties
- `frontend/src/services/api.ts` — add `fetchBuildingFootprints`

---

## Task 1: Forum CSS tokens + building footprints API function

**Files:**
- Modify: `frontend/src/styles/theme.css`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add forum CSS tokens to theme.css**

Open `frontend/src/styles/theme.css` and add these lines inside the `@theme { }` block, after the existing color section:

```css
    /* ========== FORUM ========== */
    --forum-bg:                  #EDE0CC;
    --forum-building-fill:       rgba(139, 99, 64, 0.09);
    --forum-building-stroke:     rgba(139, 99, 64, 0.22);
    --forum-building-fill-pop:   rgba(2, 122, 118, 0.12);
    --forum-building-stroke-pop: rgba(2, 122, 118, 0.40);
    --forum-card-bg:             rgba(255, 248, 235, 0.52);
    --forum-card-border:         rgba(255, 255, 255, 0.65);
    --forum-track:               rgba(59, 32, 18, 0.25);
    --forum-dot:                 rgba(59, 32, 18, 0.28);
```

- [ ] **Step 2: Add building footprints type + fetch to api.ts**

Open `frontend/src/services/api.ts`. Add the following type and function at the end of the file (before the last line):

```ts
export interface BuildingFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][];
  };
  properties: Record<string, unknown>;
}

export interface BuildingGeoJSON {
  type: 'FeatureCollection';
  features: BuildingFeature[];
}

export const fetchBuildingFootprints = async (cityId: number): Promise<BuildingGeoJSON> => {
  const response = await apiFetch(
    `${API_BASE_URL}/cities/${cityId}/features/geojson?feature_type=buildings&limit=3000`
  );
  if (!response.ok) throw new Error('Error al cargar los edificios');
  const result = await response.json();
  return result.data as BuildingGeoJSON;
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/theme.css frontend/src/services/api.ts
git commit -m "feat(forum): add CSS tokens and building footprints API function"
```

---

## Task 2: `projectGeoCoords` utility + tests

**Files:**
- Create: `frontend/src/utils/geoProjection.ts`
- Create: `frontend/src/utils/geoProjection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/geoProjection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeGeoBbox, projectGeoCoords, type GeoBbox } from './geoProjection';

describe('computeGeoBbox', () => {
  it('returns min/max of all coordinates', () => {
    const coords = [[0, 10], [5, 20], [-3, 15]] as [number, number][];
    const bbox = computeGeoBbox(coords);
    expect(bbox.minLon).toBe(-3);
    expect(bbox.maxLon).toBe(5);
    expect(bbox.minLat).toBe(10);
    expect(bbox.maxLat).toBe(20);
  });
});

describe('projectGeoCoords', () => {
  const bbox: GeoBbox = { minLon: 0, maxLon: 10, minLat: 0, maxLat: 10 };

  it('projects top-left corner to SVG origin', () => {
    // lon=0 (min), lat=10 (max) → x=0, y=0
    const pt = projectGeoCoords(0, 10, bbox, 1000, 700);
    expect(pt.x).toBeCloseTo(0);
    expect(pt.y).toBeCloseTo(0);
  });

  it('projects bottom-right corner to SVG max', () => {
    // lon=10 (max), lat=0 (min) → x=1000, y=700
    const pt = projectGeoCoords(10, 0, bbox, 1000, 700);
    expect(pt.x).toBeCloseTo(1000);
    expect(pt.y).toBeCloseTo(700);
  });

  it('projects centre to SVG centre', () => {
    const pt = projectGeoCoords(5, 5, bbox, 1000, 700);
    expect(pt.x).toBeCloseTo(500);
    expect(pt.y).toBeCloseTo(350);
  });

  it('inverts latitude (higher lat → lower y)', () => {
    const a = projectGeoCoords(5, 8, bbox, 1000, 700);
    const b = projectGeoCoords(5, 2, bbox, 1000, 700);
    expect(a.y).toBeLessThan(b.y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/utils/geoProjection.test.ts
```

Expected: FAIL — `Cannot find module './geoProjection'`

- [ ] **Step 3: Implement geoProjection.ts**

Create `frontend/src/utils/geoProjection.ts`:

```ts
export const SVG_W = 1000;
export const SVG_H = 700;

export interface GeoBbox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export function computeGeoBbox(coords: [number, number][]): GeoBbox {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

export function projectGeoCoords(
  lon: number,
  lat: number,
  bbox: GeoBbox,
  svgWidth: number,
  svgHeight: number,
): { x: number; y: number } {
  const lonRange = bbox.maxLon - bbox.minLon || 1;
  const latRange = bbox.maxLat - bbox.minLat || 1;
  return {
    x: ((lon - bbox.minLon) / lonRange) * svgWidth,
    y: ((bbox.maxLat - lat) / latRange) * svgHeight,
  };
}

```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/utils/geoProjection.test.ts
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/geoProjection.ts frontend/src/utils/geoProjection.test.ts
git commit -m "feat(forum): add geo→SVG projection utility"
```

---

## Task 3: `buildingProximity` utility + tests

**Files:**
- Create: `frontend/src/utils/buildingProximity.ts`
- Create: `frontend/src/utils/buildingProximity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/buildingProximity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findBuildingsNearPoints, type SvgRect } from './buildingProximity';

describe('findBuildingsNearPoints', () => {
  const buildings: { id: string; rect: SvgRect }[] = [
    { id: 'bldg-0', rect: { x: 100, y: 100, width: 50, height: 40 } },
    { id: 'bldg-1', rect: { x: 500, y: 400, width: 60, height: 50 } },
    { id: 'bldg-2', rect: { x: 900, y: 600, width: 40, height: 30 } },
  ];

  it('returns buildings whose rect is within threshold of any sample point', () => {
    // Point at (130, 120) is inside bldg-0's rect → within threshold of 0
    const nearby = findBuildingsNearPoints([{ x: 130, y: 120 }], buildings, 30);
    expect(nearby).toContain('bldg-0');
    expect(nearby).not.toContain('bldg-1');
  });

  it('returns building when point is within threshold distance of rect edge', () => {
    // Point at (75, 120) is 25px left of bldg-0's left edge (100) → within 30px
    const nearby = findBuildingsNearPoints([{ x: 75, y: 120 }], buildings, 30);
    expect(nearby).toContain('bldg-0');
  });

  it('does not return buildings beyond threshold', () => {
    // Point at (0, 0) is far from all buildings with threshold=30
    const nearby = findBuildingsNearPoints([{ x: 0, y: 0 }], buildings, 30);
    expect(nearby).toHaveLength(0);
  });

  it('returns multiple nearby buildings', () => {
    const points = [{ x: 130, y: 120 }, { x: 530, y: 425 }];
    const nearby = findBuildingsNearPoints(points, buildings, 30);
    expect(nearby).toContain('bldg-0');
    expect(nearby).toContain('bldg-1');
    expect(nearby).not.toContain('bldg-2');
  });

  it('deduplicates results', () => {
    // Two points both near bldg-0 → bldg-0 appears once
    const points = [{ x: 120, y: 110 }, { x: 140, y: 130 }];
    const nearby = findBuildingsNearPoints(points, buildings, 30);
    expect(nearby.filter(id => id === 'bldg-0')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/utils/buildingProximity.test.ts
```

Expected: FAIL — `Cannot find module './buildingProximity'`

- [ ] **Step 3: Implement buildingProximity.ts**

Create `frontend/src/utils/buildingProximity.ts`:

```ts
export interface SvgRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgPoint {
  x: number;
  y: number;
}

function distancePointToRect(pt: SvgPoint, rect: SvgRect): number {
  const clampedX = Math.max(rect.x, Math.min(pt.x, rect.x + rect.width));
  const clampedY = Math.max(rect.y, Math.min(pt.y, rect.y + rect.height));
  return Math.sqrt((pt.x - clampedX) ** 2 + (pt.y - clampedY) ** 2);
}

export function findBuildingsNearPoints(
  points: SvgPoint[],
  buildings: { id: string; rect: SvgRect }[],
  threshold: number,
): string[] {
  const result = new Set<string>();
  for (const pt of points) {
    for (const { id, rect } of buildings) {
      if (distancePointToRect(pt, rect) <= threshold) {
        result.add(id);
      }
    }
  }
  return Array.from(result);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/utils/buildingProximity.test.ts
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/buildingProximity.ts frontend/src/utils/buildingProximity.test.ts
git commit -m "feat(forum): add building proximity detection utility"
```

---

## Task 4: `CityBuildingBackground` component

**Files:**
- Create: `frontend/src/components/forum/CityBuildingBackground.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/forum/CityBuildingBackground.tsx`:

```tsx
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fetchBuildingFootprints, type BuildingFeature } from '../../services/api';
import {
  SVG_W, SVG_H,
  computeGeoBbox, projectGeoCoords,
  type GeoBbox,
} from '../../utils/geoProjection';

export interface CityBuildingBackgroundHandle {
  triggerPop: (polygonIds: string[]) => void;
  svgElement: SVGSVGElement | null;
}

interface Props {
  cityId: number;
}

interface ProjectedBuilding {
  id: string;
  points: string; // SVG polygon points attribute
}

function extractPolygonRings(feature: BuildingFeature): number[][][] {
  if (feature.geometry.type === 'Polygon') return [feature.geometry.coordinates[0]];
  // MultiPolygon: take first ring of each polygon
  return feature.geometry.coordinates.map(poly => poly[0]);
}

export const CityBuildingBackground = forwardRef<CityBuildingBackgroundHandle, Props>(
  ({ cityId }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [buildings, setBuildings] = useState<ProjectedBuilding[]>([]);
    const [poppedIds, setPoppedIds] = useState<Set<string>>(new Set());
    const popTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useImperativeHandle(ref, () => ({
      triggerPop(polygonIds: string[]) {
        setPoppedIds(prev => {
          const next = new Set(prev);
          for (const id of polygonIds) next.add(id);
          return next;
        });
        for (const id of polygonIds) {
          const existing = popTimersRef.current.get(id);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            setPoppedIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            popTimersRef.current.delete(id);
          }, 2500);
          popTimersRef.current.set(id, timer);
        }
      },
      get svgElement() {
        return svgRef.current;
      },
    }));

    useEffect(() => {
      let cancelled = false;

      fetchBuildingFootprints(cityId).then(geojson => {
        if (cancelled) return;

        // Collect all coordinates to compute global bbox
        const allCoords: [number, number][] = [];
        for (const feature of geojson.features) {
          for (const ring of extractPolygonRings(feature)) {
            for (const coord of ring) {
              allCoords.push([coord[0], coord[1]]);
            }
          }
        }
        if (allCoords.length === 0) return;

        const bbox: GeoBbox = computeGeoBbox(allCoords);

        const projected: ProjectedBuilding[] = [];
        let idx = 0;
        for (const feature of geojson.features) {
          for (const ring of extractPolygonRings(feature)) {
            const pointsStr = ring
              .map(([lon, lat]) => {
                const { x, y } = projectGeoCoords(lon, lat, bbox, SVG_W, SVG_H);
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              })
              .join(' ');
            projected.push({ id: `bldg-${idx}`, points: pointsStr });
            idx++;
          }
        }
        setBuildings(projected);
      }).catch(() => {
        // Background is decorative — silent failure is fine
      });

      return () => { cancelled = true; };
    }, [cityId]);

    // Cleanup timers on unmount
    useEffect(() => {
      return () => {
        for (const t of popTimersRef.current.values()) clearTimeout(t);
      };
    }, []);

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {buildings.map(({ id, points }) => (
          <polygon
            key={id}
            id={id}
            points={points}
            style={{
              fill: poppedIds.has(id)
                ? 'var(--forum-building-fill-pop)'
                : 'var(--forum-building-fill)',
              stroke: poppedIds.has(id)
                ? 'var(--forum-building-stroke-pop)'
                : 'var(--forum-building-stroke)',
              strokeWidth: 0.5,
              transition: 'fill 0.3s ease, stroke 0.3s ease',
            }}
          />
        ))}
      </svg>
    );
  }
);

CityBuildingBackground.displayName = 'CityBuildingBackground';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "CityBuildingBackground\|geoProjection\|api"
```

Expected: no output (no errors for these files)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/forum/CityBuildingBackground.tsx
git commit -m "feat(forum): add CityBuildingBackground SVG component"
```

---

## Task 5: `BuildingTrajectories` component

**Files:**
- Create: `frontend/src/components/forum/BuildingTrajectories.tsx`

The component renders an SVG overlay with three animated paths. Each path runs an independent `setTimeout`-driven cycle: draw → pop nearby buildings at midpoint → hold → fade → idle → repeat with random delay.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/forum/BuildingTrajectories.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { SVG_W, SVG_H } from '../../utils/geoProjection';
import { findBuildingsNearPoints, type SvgRect } from '../../utils/buildingProximity';
import type { CityBuildingBackgroundHandle } from './CityBuildingBackground';

interface Props {
  bgRef: React.RefObject<CityBuildingBackgroundHandle>;
}

// Paths in 1000×700 SVG coordinate space
const TRAJECTORY_DEFS = [
  { id: 'traj-0', d: `M 0,98 Q 250,70 500,154 T ${SVG_W},126` },
  { id: 'traj-1', d: `M 0,385 Q 250,350 500,420 T ${SVG_W},385` },
  { id: 'traj-2', d: `M ${SVG_W},546 Q 750,511 500,574 T 0,546` },
];

const DRAW_DURATION_MS = 2500;
const HOLD_MS = 1000;
const FADE_MS = 500;
const MIN_REPEAT_MS = 8000;
const MAX_REPEAT_MS = 16000;
const PROXIMITY_THRESHOLD = 30;
const PATH_SAMPLE_COUNT = 30;

type PathState = 'idle' | 'drawing' | 'fading';

function samplePathPoints(pathEl: SVGPathElement, n: number) {
  const len = pathEl.getTotalLength();
  const points = [];
  for (let i = 0; i <= n; i++) {
    const pt = pathEl.getPointAtLength((i / n) * len);
    points.push({ x: pt.x, y: pt.y });
  }
  return points;
}

function getBuildingRects(svgEl: SVGSVGElement): { id: string; rect: SvgRect }[] {
  const polygons = svgEl.querySelectorAll<SVGPolygonElement>('polygon[id^="bldg-"]');
  const result: { id: string; rect: SvgRect }[] = [];
  for (const poly of polygons) {
    const bbox = poly.getBBox();
    result.push({ id: poly.id, rect: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height } });
  }
  return result;
}

export function BuildingTrajectories({ bgRef }: Props) {
  const [pathStates, setPathStates] = useState<Record<string, PathState>>({
    'traj-0': 'idle',
    'traj-1': 'idle',
    'traj-2': 'idle',
  });
  const [pathLengths, setPathLengths] = useState<Record<string, number>>({});
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Measure path lengths after mount
  useEffect(() => {
    const lengths: Record<string, number> = {};
    for (const { id } of TRAJECTORY_DEFS) {
      const el = pathRefs.current[id];
      if (el) {
        try { lengths[id] = el.getTotalLength(); } catch { lengths[id] = 1000; }
      }
    }
    setPathLengths(lengths);
  }, []);

  // Start animation cycles once lengths are known
  useEffect(() => {
    if (Object.keys(pathLengths).length === 0) return;

    const timers = timersRef.current;
    const initialDelays: Record<string, number> = { 'traj-0': 500, 'traj-1': 4500, 'traj-2': 9000 };

    const scheduleTrajectory = (id: string, delay: number) => {
      const t = setTimeout(() => {
        // Start drawing
        setPathStates(prev => ({ ...prev, [id]: 'drawing' }));

        // At midpoint: trigger building pop
        const mid = setTimeout(() => {
          const bgHandle = bgRef.current;
          const pathEl = pathRefs.current[id];
          if (bgHandle?.svgElement && pathEl) {
            try {
              const points = samplePathPoints(pathEl, PATH_SAMPLE_COUNT);
              const buildingRects = getBuildingRects(bgHandle.svgElement);
              const nearby = findBuildingsNearPoints(points, buildingRects, PROXIMITY_THRESHOLD);
              if (nearby.length > 0) bgHandle.triggerPop(nearby);
            } catch {
              // svgEl not ready or jsdom — skip pop
            }
          }
        }, DRAW_DURATION_MS / 2);

        // After draw completes: fade
        const fade = setTimeout(() => {
          setPathStates(prev => ({ ...prev, [id]: 'fading' }));

          // After fade: go idle, schedule next
          const reset = setTimeout(() => {
            setPathStates(prev => ({ ...prev, [id]: 'idle' }));
            const nextDelay = MIN_REPEAT_MS + Math.random() * (MAX_REPEAT_MS - MIN_REPEAT_MS);
            scheduleTrajectory(id, nextDelay);
          }, FADE_MS);
          timers.push(reset);
        }, DRAW_DURATION_MS + HOLD_MS);

        timers.push(mid, fade);
      }, delay);
      timers.push(t);
    };

    for (const { id } of TRAJECTORY_DEFS) {
      scheduleTrajectory(id, initialDelays[id]);
    }

    return () => {
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
    };
  }, [pathLengths, bgRef]);

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {TRAJECTORY_DEFS.map(({ id, d }) => {
        const len = pathLengths[id] ?? 1200;
        const state = pathStates[id];
        const isDrawing = state === 'drawing';
        const isFading = state === 'fading';

        return (
          <g key={id}>
            <path
              ref={el => { pathRefs.current[id] = el; }}
              d={d}
              fill="none"
              stroke="var(--green-dark)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={isDrawing ? 0 : len}
              opacity={isFading ? 0 : 0.7}
              style={{
                transition: isDrawing
                  ? `stroke-dashoffset ${DRAW_DURATION_MS}ms ease-in-out, opacity ${FADE_MS}ms ease`
                  : isFading
                  ? `opacity ${FADE_MS}ms ease`
                  : 'none',
              }}
            />
            {/* Travelling dot */}
            {isDrawing && (
              <circle r={3} fill="var(--green-dark)" opacity={0.9}>
                <animateMotion
                  dur={`${DRAW_DURATION_MS}ms`}
                  path={d}
                  fill="freeze"
                />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "BuildingTrajectories\|buildingProximity"
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/forum/BuildingTrajectories.tsx
git commit -m "feat(forum): add animated building trajectory component"
```

---

## Task 6: `NewsCard` glassmorphism

**Files:**
- Modify: `frontend/src/components/forum/NewsCard.tsx`

- [ ] **Step 1: Replace NewsCard with glassmorphism version**

Replace the entire contents of `frontend/src/components/forum/NewsCard.tsx`:

```tsx
import React from 'react';
import type { NewsItem } from '../../types/news';

interface NewsCardProps {
  item: NewsItem;
}

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const dateStr = new Date(item.publication_dt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      data-news-id={item.id}
      className="group block mb-3"
      style={{ position: 'relative' }}
    >
      <div
        style={{
          background: 'var(--forum-card-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--forum-card-border)',
          borderRadius: '12px',
          padding: '0.9rem 1.1rem',
          boxShadow: '0 2px 16px rgba(139,99,64,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="group-hover:[transform:translateY(-2px)] group-hover:[box-shadow:0_6px_24px_rgba(139,99,64,0.14),inset_0_1px_0_rgba(255,255,255,0.7)]"
      >
        {/* Top shine */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
          }}
        />
        <h3
          style={{
            fontFamily: 'var(--heading)',
            fontSize: '0.88rem',
            fontWeight: 700,
            color: '#3B2012',
            lineHeight: 1.35,
            marginBottom: '0.3rem',
            transition: 'color 0.15s',
          }}
          className="group-hover:[color:#027A76]"
        >
          {item.headline}
        </h3>
        <p style={{ fontSize: '0.68rem', color: 'rgba(59,32,18,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {item.source} — {dateStr}
        </p>
        {item.summary && (
          <p style={{ fontSize: '0.78rem', color: 'rgba(59,32,18,0.65)', lineHeight: 1.45, marginTop: '0.35rem', fontStyle: 'italic' }}>
            {item.summary}
          </p>
        )}
      </div>
    </a>
  );
};

export default NewsCard;
```

- [ ] **Step 2: Check the app compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep NewsCard
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/forum/NewsCard.tsx
git commit -m "feat(forum): glassmorphism NewsCard styles"
```

---

## Task 7: `NewsTimeline` naked rail + proportional thumb

**Files:**
- Modify: `frontend/src/components/forum/NewsTimeline.tsx`

- [ ] **Step 1: Replace NewsTimeline with naked-rail version**

Replace the entire contents of `frontend/src/components/forum/NewsTimeline.tsx`:

```tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { NewsItem } from '../../types/news';

interface NewsTimelineProps {
  items: NewsItem[];
  onDotClick: (index: number) => void;
}

const MIN_THUMB_PX = 32;

const NewsTimeline: React.FC<NewsTimelineProps> = ({ items, onDotClick }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(64);

  // Date-proportional dot positions (0–100%)
  const dates = items.map(i => new Date(i.publication_dt).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;
  const dotPositions = items.map(item =>
    ((new Date(item.publication_dt).getTime() - minDate) / dateRange) * 100
  );

  // Year labels
  const yearLabels: { year: number; position: number }[] = [];
  const seenYears = new Set<number>();
  items.forEach((item, idx) => {
    const year = new Date(item.publication_dt).getFullYear();
    if (!seenYears.has(year)) {
      seenYears.add(year);
      yearLabels.push({ year, position: dotPositions[idx] });
    }
  });

  const computeThumbHeight = useCallback(() => {
    if (!trackRef.current) return MIN_THUMB_PX;
    const trackH = trackRef.current.clientHeight;
    const docH = document.documentElement.scrollHeight;
    const viewH = window.innerHeight;
    return Math.max(MIN_THUMB_PX, (viewH / docH) * trackH);
  }, []);

  const computeThumbTop = useCallback((currentThumbH: number) => {
    if (!trackRef.current) return 0;
    const trackH = trackRef.current.clientHeight;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (docH <= 0) return 0;
    const scrollFraction = window.scrollY / docH;
    return scrollFraction * (trackH - currentThumbH);
  }, []);

  const updateThumb = useCallback(() => {
    const h = computeThumbHeight();
    setThumbHeight(h);
    setThumbTop(computeThumbTop(h));
  }, [computeThumbHeight, computeThumbTop]);

  const handleThumbPointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const trackH = trackRect.height;
    const h = computeThumbHeight();
    const dragY = e.clientY - trackRect.top;
    const constrained = Math.max(0, Math.min(dragY, trackH - h));
    const fraction = trackH > h ? constrained / (trackH - h) : 0;
    window.scrollTo({ top: fraction * (document.documentElement.scrollHeight - window.innerHeight), behavior: 'auto' });
  }, [computeThumbHeight]);

  const handlePointerUp = () => { isDraggingRef.current = false; };

  useEffect(() => {
    updateThumb();
    window.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('scroll', updateThumb);
      window.removeEventListener('resize', updateThumb);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [updateThumb, handlePointerMove]);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        height: '100vh',
        width: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        ref={trackRef}
        style={{ position: 'relative', height: 'calc(100% - 80px)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Track line */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: '50%',
          width: '1px',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(to bottom, transparent, var(--forum-track) 8%, var(--forum-track) 92%, transparent)',
        }} />

        {/* Year labels */}
        {yearLabels.map(label => (
          <div
            key={label.year}
            style={{
              position: 'absolute',
              right: 'calc(50% + 7px)',
              top: `${label.position}%`,
              transform: 'translateY(-50%)',
              fontSize: '0.46rem',
              fontWeight: 700,
              color: 'rgba(59,32,18,0.38)',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            {label.year}
          </div>
        ))}

        {/* Article dots */}
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => onDotClick(idx)}
            title={item.headline}
            style={{
              position: 'absolute',
              left: '50%',
              top: `${dotPositions[idx]}%`,
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--forum-dot)',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'background 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.background = 'var(--green-dark)';
              (e.target as HTMLElement).style.transform = 'translateX(-50%) scale(1.8)';
              (e.target as HTMLElement).style.boxShadow = '0 0 5px rgba(2,122,118,0.5)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.background = 'var(--forum-dot)';
              (e.target as HTMLElement).style.transform = 'translateX(-50%)';
              (e.target as HTMLElement).style.boxShadow = 'none';
            }}
          />
        ))}

        {/* Proportional thumb */}
        <div
          onPointerDown={handleThumbPointerDown}
          style={{
            position: 'absolute',
            left: '50%',
            top: `${thumbTop}px`,
            height: `${thumbHeight}px`,
            width: '10px',
            transform: 'translateX(-50%)',
            borderRadius: '5px',
            background: 'rgba(2,122,118,0.75)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 2px 6px rgba(2,122,118,0.3)',
            cursor: 'grab',
            pointerEvents: 'auto',
          }}
        />
      </div>
    </div>
  );
};

export default NewsTimeline;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep NewsTimeline
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/forum/NewsTimeline.tsx
git commit -m "feat(forum): naked-rail timeline with proportional thumb"
```

---

## Task 8: Wire everything together in `ForumPage`

**Files:**
- Modify: `frontend/src/pages/ForumPage.tsx`

- [ ] **Step 1: Replace ForumPage with wired version**

Replace the entire contents of `frontend/src/pages/ForumPage.tsx`:

```tsx
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { getNews } from '../services/newsService';
import NewsCard from '../components/forum/NewsCard';
import NewsSearch from '../components/forum/NewsSearch';
import NewsTimeline from '../components/forum/NewsTimeline';
import { CityBuildingBackground, type CityBuildingBackgroundHandle } from '../components/forum/CityBuildingBackground';
import { BuildingTrajectories } from '../components/forum/BuildingTrajectories';
import { fetchCities } from '../services/api';
import { Search, X } from 'lucide-react';

const ForumPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [cityId, setCityId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<CityBuildingBackgroundHandle>(null);

  const allNews = useMemo(() => getNews(), []);

  const filteredNews = useMemo(() => {
    if (!searchQuery.trim()) return allNews;
    const q = searchQuery.toLowerCase();
    return allNews.filter(item =>
      item.headline.toLowerCase().includes(q) ||
      (item.summary && item.summary.toLowerCase().includes(q))
    );
  }, [searchQuery, allNews]);

  // Pick a random city with a valid id on mount
  useEffect(() => {
    fetchCities().then(cities => {
      const valid = cities.filter(c => c.id != null);
      if (valid.length === 0) return;
      const picked = valid[Math.floor(Math.random() * valid.length)];
      setCityId(picked.id as number);
    }).catch(() => {
      // Background is decorative — no fallback needed
    });
  }, []);

  const handleDotClick = (index: number) => {
    const cards = document.querySelectorAll('[data-news-id]');
    if (cards[index]) {
      const card = cards[index] as HTMLElement;
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearch]);

  return (
    <div
      className="relative min-h-screen scrollbar-hide"
      style={{ background: 'var(--forum-bg)' }}
    >
      {/* Layer 1: city building SVG background */}
      {cityId !== null && (
        <CityBuildingBackground cityId={cityId} ref={bgRef} />
      )}

      {/* Layer 2: trajectory animations */}
      {cityId !== null && (
        <BuildingTrajectories bgRef={bgRef} />
      )}

      {/* Layer 3: page content */}
      <div style={{ position: 'relative', zIndex: 3 }}>

        {/* Glassmorphism sticky header */}
        <div
          className="sticky top-0 z-50 py-5 px-8"
          style={{
            background: 'rgba(237, 224, 204, 0.72)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderBottom: '1px solid rgba(255,255,255,0.5)',
          }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <h1
              className="font-heading text-2xl font-bold"
              style={{ color: '#3B2012' }}
            >
              Foro de Noticias
            </h1>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded transition-colors"
              style={{ background: 'rgba(255,255,255,0.25)' }}
            >
              {showSearch
                ? <X size={20} style={{ color: '#3B2012' }} />
                : <Search size={20} style={{ color: '#3B2012' }} />}
            </button>
          </div>

          {showSearch && (
            <div className="max-w-4xl mx-auto mt-4">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar noticias..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full outline-none font-body text-base py-2 px-1 transition-colors"
                style={{
                  background: 'transparent',
                  color: '#3B2012',
                  borderBottom: '2px solid rgba(59,32,18,0.35)',
                }}
              />
            </div>
          )}
        </div>

        {/* Feed */}
        <div className="pr-10 max-w-4xl mx-auto py-6 px-8">
          {filteredNews.length > 0
            ? filteredNews.map(item => (
                <NewsCard key={item.id} item={item} />
              ))
            : (
              <div className="p-6 text-center" style={{ color: 'rgba(59,32,18,0.5)' }}>
                No hay noticias que coincidan con tu búsqueda.
              </div>
            )}
        </div>
      </div>

      {/* Timeline (fixed, floats over everything) */}
      <NewsTimeline items={filteredNews} onDotClick={handleDotClick} />
    </div>
  );
};

export default ForumPage;
```

- [ ] **Step 2: Verify full TypeScript compile**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run the dev server and open the forum**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/forum` (or whatever port is shown). Verify:
- Warm parchment background visible
- Building footprint polygons appear as subtle outlines (after ~1–2s API load)
- News cards have frosted glass look
- Timeline on right: thin hairline + small dots + proportional teal capsule thumb
- After ~4–9s the first trajectory path draws across the screen
- Buildings near the path briefly turn teal

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ForumPage.tsx
git commit -m "feat(forum): wire background, trajectories, and layout into ForumPage"
```

---

## Task 9: Run all unit tests

- [ ] **Step 1: Run unit tests**

```bash
cd frontend && npx vitest run --project unit
```

Expected: all tests pass, including:
- `src/utils/geoProjection.test.ts` — 5 tests
- `src/utils/buildingProximity.test.ts` — 5 tests

- [ ] **Step 2: Final commit if any cleanup was needed**

If you had to fix anything, commit:

```bash
git add -p
git commit -m "fix(forum): test/typecheck fixes"
```
