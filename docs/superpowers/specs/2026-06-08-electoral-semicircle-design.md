# Electoral Semicircle — Design Spec

**Date:** 2026-06-08  
**Status:** Approved

## Summary

Add an electoral hemiciclo to the Transparencia mode that shows the composition of the city council (pleno) from the most recent municipal election. One dot per elected concejal, colored by party, arranged across two concentric arcs.

## Data

**Source:** `city_elections` table — `year, party, votes, councilors` per city, ingested from the Spanish Ministry of Interior (2023 data currently loaded).

**API:** `fetchMayorsTimeline(cityId)` at `/cities/{id}/mayors` already returns `elections: ElectionResult[]` alongside mayors. No new endpoint needed.

**Types:** `ElectionResult` is already typed in `frontend/src/services/api.ts`:
```ts
interface ElectionResult {
  year: number;
  party: string;
  votes: number | null;
  councilors: number | null;
}
```

## Data Flow

`TransparencyContainer` (in `ModeStatsRouter.tsx`) adds `fetchMayorsTimeline(city.id)` to its existing `Promise.all`. The `elections` array is stored in local state and passed as a new `elections` prop to `TransparencyStats`.

`TransparencyStats` gates rendering on:
```ts
submodes.includes('electoral') && elections.length > 0
```

The `'electoral'` submode is already written to `city_modes.transparency_submodes` by `refresh_city_modes()` in the backend when `city_elections` has rows for a city. No backend changes required.

## Component: `ElectoralSemicircle`

**File:** `frontend/src/components/city/plots/ElectoralSemicircle.tsx`

**Props:**
```ts
interface ElectoralSemicircleProps {
  elections: ElectionResult[];
  title?: string;
}
```

**Card style:** Same `rounded-2xl border bg-white/80 backdrop-blur-sm p-5` as other plots.

### Dot Layout Algorithm

1. Filter to `councilors > 0`, sort descending by councilors (largest party first)
2. Total seats = sum of all councilors
3. Distribute dots across **2 concentric arcs** (inner row, outer row) spanning 180°
   - Inner arc radius: `~0.55 * halfWidth`
   - Outer arc radius: `~0.85 * halfWidth`
   - Fill outer arc first (more dots fit), then inner arc
   - Within each arc, space dots evenly across the full 180°
4. Assign arc positions left-to-right in party order (largest → smallest), so parties fill the arc contiguously
5. Each dot: circle element, `r` scaled to fit (typically 5–7px depending on width)
6. Color: `getPartyColor(party)` from `constants/parties.ts`

**Responsive:** `ResizeObserver` on container div, same pattern as `MayorsGanttChart`.

### Tooltip

On `mouseenter` of any dot: floating div showing:
- Party name (bold)
- Seat count: `N concejales`
- Vote count: `N votos` (if non-null), formatted with `toLocaleString('es-ES')`

### Legend

Compact flex-wrap row below SVG: colored dot + party abbreviation + seat count, one item per party with `councilors > 0`.

### Placement in `TransparencyStats`

Appended after the `MayorsGanttChart` block, before the closing `</div>`.

## Year

Only the most recent election year is shown (derived by `Math.max(...elections.map(e => e.year))`). No year selector UI.

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/city/plots/ElectoralSemicircle.tsx` | New component |
| `frontend/src/components/city/ModeStatsRouter.tsx` | Add `fetchMayorsTimeline` to `TransparencyContainer`, pass `elections` prop |
| `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx` | Add `elections` prop, render `ElectoralSemicircle` |

## Out of Scope

- Multiple election year selector
- Majority line / governance badge
- Vote-share arc view
- Backend changes
