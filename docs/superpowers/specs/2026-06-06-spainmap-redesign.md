# Spain Map Redesign — Design Spec

**Date:** 2026-06-06  
**Status:** Approved  
**Scope:** `SpainMap.tsx`, `ScrollableCityCards.tsx`, `constants/cities.ts`

---

## Goals

Improve the landing-page Spain map for the primary use case: **city navigation** (users scan the map, find their city, click through to its page). Three confirmed pain points drive this work:

1. Floating city card appears in the wrong position or overlaps pins
2. City name labels are hard to read (especially near coasts)
3. Mobile city carousel jumps erratically on swipe

---

## Change 1 — Smart Floating Card Placement

### Current behaviour
`SpainMap.tsx` uses a 2-axis quadrant split (`longitude > -3.7` → right; `latitude > 40` → top) to choose one of four fixed card positions. Cities sharing a quadrant produce overlapping cards.

### New behaviour
When a city pin is clicked, the card placement algorithm:

1. Generates **candidate zones** in priority order: right-sea, left-sea, top-sea, bottom-sea, top-right, top-left, bottom-right, bottom-left.
2. For each candidate, computes the card bounding rect (`cardW × cardH`, offset from pin by a gap).
3. Checks two constraints:
   - **In-bounds:** all four card corners remain within the SVG viewport (with a configurable edge margin, default 16px).
   - **Off-land:** the card rect does not overlap the Spain SVG path. Tested by sampling the four corners of the rect against `spainPath.isPointInFill(pt)` — if any corner is inside the path, the candidate is rejected.
4. Picks the first valid candidate.
5. Falls back to the candidate with the fewest corners landing on land (0 = best) if none passes both constraints.

The connector line (pin → card) continues to use the existing L-shaped SVG path but is now computed from the chosen candidate position rather than the fixed quadrant coordinates.

### Connector line animation
The connector line draws itself on appearance using a CSS `stroke-dashoffset` animation (400ms, ease-out). The card fades in with a 50ms delay over 300ms (`opacity` transition).

---

## Change 2 — Boundary-Aware Label Placement

### Current behaviour
City name labels are rendered as SVG `<text>` elements placed below each pin on desktop. Labels near coastlines can straddle the land/sea boundary, making them illegible (dark text over sea or light text over land).

### New behaviour

**Placement algorithm** (runs inside a `useEffect` that depends on `[geoData, projection, size]`, after D3 has drawn the Spain path into the DOM — requires the rendered `.spain-shape` element via `svgRef`):

For each city pin at pixel `(px, py)`:

1. Compute bounding rects for four candidate label positions: **below**, **above**, **right**, **left**. Label dimensions estimated from character count × font metrics (approx 7px/char × 11px font-size).
2. For each candidate rect, sample **5 points**: 4 corners + centroid.
3. Call `spainEl.isPointInFill(svgPoint)` for each sample point.
4. Classify:
   - All 5 = land → **valid, dark text** (`#1a2a1a`, ~80% opacity)
   - All 5 = sea → **valid, light text** (`rgba(255,255,255,0.9)`)
   - Mixed → **invalid**, skip to next candidate
5. If no candidate passes, the label is **hidden** by default and shown on hover only.

**Overlap avoidance** runs after boundary placement. Labels are committed in descending population order. If a newly placed label bounding box intersects any already-committed label, it is hidden (hover-only). This is a greedy sweep — not globally optimal but fast and good enough for the number of cities (~10–20).

**Text shadow** is applied to all labels (both land and sea) for legibility: `0 0 4px rgba(255,255,255,0.6)` for land text and `0 1px 3px rgba(0,0,0,0.8)` for sea text.

### Implementation note
`spainEl.isPointInFill()` requires an `SVGPoint` created via `svgRef.current.createSVGPoint()`. The Spain shape element must be selected by class `.spain-shape` (already present). This check is synchronous and runs on the already-rendered path, so no additional GeoJSON processing is needed.

---

## Change 3 — Mobile Carousel Momentum Fix

### Current behaviour (`ScrollableCityCards.tsx`)
On `touchend`, momentum is applied as a single instant state update: `setScrollOffset(prev => prev + (-velocity * 8))`. A 50ms snap timer then fires. The large multiplier (8) combined with the instant jump causes the carousel to visually jump several cards at once before snapping back.

### New behaviour
Replace the instant momentum jump with an `requestAnimationFrame` deceleration loop:

```
onTouchEnd:
  const momentum = clamp(velocity * 3, -2.5, 2.5)   // cap at 2.5 cards/frame
  startMomentumAnimation(momentum)

momentumLoop (rAF):
  v = v * 0.88                                        // friction factor
  setScrollOffset(prev => prev + v)
  if |v| < 0.05: cancelAnimationFrame(); snap()
```

- Friction factor `0.88` decays to `< 0.05` in approximately 20 frames (~333ms at 60fps).
- `clamp(-2.5, 2.5)` prevents a single fast flick from jumping more than 2–3 cards.
- Snap on loop exit: `setScrollOffset(Math.round(current))` — same snap logic as existing idle snap, just triggered by the loop rather than the 50ms timer.
- The `(window as any)._wheelTimer` hack is replaced with a `useRef<ReturnType<typeof setTimeout>>` ref.

---

## Change 4 — Dead Code Removal

| Item | File | Action |
|------|------|--------|
| `expandedCity` prop | `SpainMap.tsx` interface + destructuring | Remove — never used |
| `mapCoords` field | `CityData` interface in `constants/cities.ts` | Remove — marked deprecated, no references |
| `(window as any)._wheelTimer` | `ScrollableCityCards.tsx` | Replace with `useRef<ReturnType<typeof setTimeout>>` |

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/landing/SpainMap.tsx` | Smart card placement, boundary-aware label algorithm, connector animation, remove `expandedCity` |
| `frontend/src/components/ui/ScrollableCityCards.tsx` | rAF momentum deceleration, remove `_wheelTimer` hack |
| `frontend/src/constants/cities.ts` | Remove deprecated `mapCoords` field |

---

## Out of Scope

- Province boundaries / choropleth (data encoding)
- Redesigning the `CityCard` content
- Desktop-to-mobile layout changes (section heights, wave background)
- Canary Islands inset box refactor (coordinate offset approach kept as-is)
