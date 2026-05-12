# Forum Visual Redesign — Design Spec

**Date**: 2026-05-12
**Branch**: `feat/forum`
**Status**: Approved

---

## Overview

Redesign the `/forum` page with three visual layers: a static bird's-eye city building footprint SVG background, glassmorphism news cards, and an animated trajectory system that makes buildings near each path pop with a dark-green tint. The timeline scrollbar on the right becomes a naked rail with a proportional thumb — no sidebar panel.

---

## 1. Palette

All new values extend the existing theme without replacing it. Forum-specific overrides:

| Token | Value | Use |
|---|---|---|
| `--forum-bg` | `#EDE0CC` | Page background (warm parchment) |
| `--forum-building-fill` | `rgba(139,99,64,0.09)` | Building polygon fill at rest |
| `--forum-building-stroke` | `rgba(139,99,64,0.22)` | Building polygon stroke at rest |
| `--forum-building-fill-pop` | `rgba(2,122,118,0.12)` | Building fill during pop |
| `--forum-building-stroke-pop` | `rgba(2,122,118,0.4)` | Building stroke during pop |
| `--forum-card-bg` | `rgba(255,248,235,0.52)` | Glassmorphism card background |
| `--forum-card-border` | `rgba(255,255,255,0.65)` | Glassmorphism card border |
| `--forum-track` | `rgba(59,32,18,0.25)` | Timeline track line |
| `--forum-dot` | `rgba(59,32,18,0.28)` | Timeline dot at rest |

Existing tokens reused: `--green-dark` (#027A76) for trajectories, thumb, dot active state; `--blue-dark` (#003849) for card headlines.

---

## 2. Background: City Building SVG

### Data source

`GET /api/cities/{city_id}/features/geojson?feature_type=buildings&limit=3000`

- `city_id` is picked randomly from the available cities list on first mount (using the existing `CITIES` constant). Stored in component state — no re-fetch on re-render.
- Future: accept a `cityId` prop from the forum's city filter so the background updates with the filter selection.

### New component: `CityBuildingBackground.tsx`

`frontend/src/components/forum/CityBuildingBackground.tsx`

**Props:**
```ts
interface CityBuildingBackgroundProps {
  cityId: number;
}

// Imperative handle exposed via forwardRef + useImperativeHandle
interface CityBuildingBackgroundHandle {
  triggerPop: (polygonIds: string[]) => void;
  svgElement: SVGSVGElement | null; // direct SVG ref for getPointAtLength queries
}
```

**Behaviour:**
1. On mount, fetch building GeoJSON for the given city.
2. Compute the bounding box of all coordinates across all features.
3. Project every polygon vertex from geographic coords to SVG viewport coords using a linear scale: `svgX = (lon - minLon) / (maxLon - minLon) * W`, same for Y (latitude inverted).
4. Render an absolutely-positioned `<svg>` covering the full viewport (`position: absolute; inset: 0; width: 100%; height: 100%`), with `preserveAspectRatio="xMidYMid slice"` so the city fills the frame at any aspect ratio.
5. Each building polygon is a `<polygon>` with class `bldg-poly`. Outer rings only (no holes for now).
6. Expose `{ triggerPop, svgElement }` via `useImperativeHandle` (component is a `forwardRef`) so the trajectory layer can both query polygon positions and trigger pops.

**Pop animation:**
- On `triggerPop`, add class `bldg-poly--popped` to the target elements.
- CSS handles the transition: `fill` and `stroke` transition to pop values over 300ms, then a `@keyframes` scale pulse (scale 1 → 1.015 → 1 over 500ms), then revert after 2.5s.
- Building elements get `id="bldg-{index}"` for targeting.

**Performance:** With `limit=3000`, expect 500–2000 polygons for a city-centre bbox. No virtualization needed — SVG handles this count without frame drops.

---

## 3. Trajectory Animation

### New component: `BuildingTrajectories.tsx`

`frontend/src/components/forum/BuildingTrajectories.tsx`

**Props:**
```ts
interface BuildingTrajectoriesProps {
  bgRef: React.RefObject<CityBuildingBackgroundHandle>; // handle from CityBuildingBackground
}
```

Internally uses `bgRef.current.svgElement` for `getPointAtLength` queries and calls `bgRef.current.triggerPop(ids)` when a trajectory passes.

**Trajectory paths:** Three pre-defined SVG cubic bezier paths that cross the viewport diagonally. They are expressed as relative fractions of the viewport (0–1) and scaled to actual pixel dimensions at render time. Example paths (in unit coordinates):

- Path 1: `M 0,0.14  Q 0.25,0.10 0.5,0.22  T 1.0,0.18` — upper sweep L→R
- Path 2: `M 0,0.55  Q 0.25,0.50 0.5,0.60  T 1.0,0.55` — mid sweep L→R  
- Path 3: `M 1.0,0.78 Q 0.75,0.73 0.5,0.82  T 0.0,0.78` — lower sweep R→L

**Animation cycle (per path, staggered):**
1. Draw path via `stroke-dashoffset` from full length to 0 over 2.5s (ease-in-out).
2. A `<circle>` travels the path using `<animateMotion>` in sync.
3. At the midpoint of the draw (1.25s in), call `onBuildingsPop` with the IDs of buildings within 30px of the path. Buildings are found by sampling ~20 points along the path using `SVGPathElement.getPointAtLength()` and checking each `<polygon>` bounding box for proximity.
4. After the path is fully drawn, hold for 1s, then fade out over 0.5s.
5. Wait a random interval (8–16s) before replaying on that path slot.

All three paths run independently with staggered initial delays (0s, 4s, 8s).

---

## 4. Glassmorphism NewsCard

Replaces the current flat `NewsCard.tsx` in place.

```css
background: rgba(255, 248, 235, 0.52);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.65);
border-radius: 12px;
box-shadow:
  0 2px 16px rgba(139, 99, 64, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.7);
```

A `::before` pseudo-element adds a top shine: `linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)` at 1px height.

Hover: `translateY(-2px)` + stronger shadow.

Text colours: headline `#3B2012`, meta `rgba(59,32,18,0.5)`.

---

## 5. Timeline Rail

Updates `NewsTimeline.tsx` in place.

### Visual

- **No sidebar background** — the rail floats over the content.
- **Track**: 1px vertical line, `rgba(59,32,18,0.25)`, gradient fades to transparent at both ends (top/bottom 8% of track height).
- **Dots**: 5px circles, `rgba(59,32,18,0.28)`. Active/hovered: `#027A76` + `box-shadow: 0 0 5px rgba(2,122,118,0.5)` + scale 1.4.
- **Year labels**: `0.46rem`, bold, `rgba(59,32,18,0.38)`, positioned to the left of the track at year-boundary dots.
- **Thumb**: thin capsule (10px wide), `rgba(2,122,118,0.75)`, `border-radius: 5px`, subtle shadow. No grip lines — too decorative.

### Proportional thumb height

```ts
thumbHeight = Math.max(32, (window.innerHeight / document.documentElement.scrollHeight) * trackHeight)
```

Recomputed on scroll and on window resize. The existing drag mechanics are unchanged — only the height calculation changes.

### Width

Reduce from `w-20` (80px) to `w-10` (40px). The rail no longer needs panel space.

---

## 6. ForumPage layout

### Background wiring

`ForumPage.tsx` renders `CityBuildingBackground` and `BuildingTrajectories` as absolutely-positioned layers beneath the content:

```tsx
const bgRef = useRef<CityBuildingBackgroundHandle>(null);

<div ref={pageRef} className="relative min-h-screen" style={{ background: 'var(--forum-bg)' }}>
  <CityBuildingBackground cityId={selectedCityId} ref={bgRef} />
  <BuildingTrajectories bgRef={bgRef} />
  {/* header, feed, timeline as before */}
</div>
```

`BuildingTrajectories` reads from `bgRef.current` inside its own effects — never at render time — so the null-on-first-render problem is avoided.

`selectedCityId` is initialised to a random pick from `CITIES` on first render (useMemo with no deps). Added to component state so it can later be wired to the city filter.

### Header

The sticky header gets the same glassmorphism treatment as the cards:

```css
background: rgba(237, 224, 204, 0.72);
backdrop-filter: blur(18px);
border-bottom: 1px solid rgba(255, 255, 255, 0.5);
```

---

## 7. New files

| File | Purpose |
|---|---|
| `frontend/src/components/forum/CityBuildingBackground.tsx` | Fetch + render building SVG, expose `triggerPop` |
| `frontend/src/components/forum/BuildingTrajectories.tsx` | Animated trajectory paths + proximity pop trigger |

## 8. Modified files

| File | Change |
|---|---|
| `frontend/src/components/forum/NewsCard.tsx` | Glassmorphism styles + pop state |
| `frontend/src/components/forum/NewsTimeline.tsx` | Naked rail, proportional thumb height |
| `frontend/src/pages/ForumPage.tsx` | Background layers, city selection, glassmorphism header |

---

## Out of scope

- City filter UI (forum header chip shows current city name, read-only for now)
- Mobile layout
- Trajectory paths vary by city (same 3 fixed paths for all cities)
- Building holes / donuts (outer ring only)
