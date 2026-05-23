# Period Range Timeline — Refactor Plan

## Goal

Replace single-year selectors with a unified draggable range widget, shared by Accidents and Traffic stats panels. Remove the year selector from `MapFilters.tsx`.

---

## User requirements

1. Delete year selector from `MapFilters.tsx` — period selection lives only in the stats panel.
2. Replace the current `YearTimeline` (click to select one year) with a **draggable range bar**:
   - A thick colored line represents the selected period.
   - The **left end** is draggable → changes start of range.
   - The **right end** is draggable → changes end of range.
   - **Dragging the bar itself** (middle) shifts the whole period.
   - Default: last available year/period selected for both ends.
3. Apply the same widget to the **Traffic stats** panel (`PeriodDropdown` → range bar).
4. The **"Año de datos" MetricPill and the timeline are one unified card**, not two separate elements:
   - Header: calendar icon + big range value (e.g. `2021 – 2023`) + sublabel (`Período · 3 años`).
   - Below divider: the draggable track.

---

## New component: `PeriodRangeTimeline`

**File:** `frontend/src/components/city/map/modes/PeriodRangeTimeline.tsx`

### Props

```ts
interface Props {
  items: string[];           // sorted array of valid values (years or "YYYY-MM")
  from: string;              // currently selected start
  to: string;                // currently selected end
  onChange: (from: string, to: string) => void;
  accent: string;            // brand color for bar + handles
  unit?: string;             // default 'año' — used for sublabel ("3 años")
  formatLabel?: (item: string) => string; // optional label formatter for tick marks
}
```

### Layout (56px track height)

```
[Card]
  [Header row]
    [Calendar icon 40×40]  [Range value 2xl bold]  [Período · N años 11px]
  [1px divider]
  [Track — 52px tall]
    ── (gray bg 2px line, top:13)
    ████████████ (thick bar 10px, rounded, accent color, top:9)
    ●            (from handle 20px circle, top:4)
           ●     (to handle 20px circle, top:4)
    ||||||||||||  (tick marks 2×6px per item, top:11, white if in-range)
    2019 .. 2023  (labels 9px, top:30)
```

### Drag logic

Three drag modes (detected on `pointerdown` based on click position relative to handle centers):

| Click zone | Mode | Behavior |
|---|---|---|
| Within ~20px of left handle | `'from'` | Moves start, clamped to ≤ toIdx |
| Within ~20px of right handle | `'to'` | Moves end, clamped to ≥ fromIdx |
| Between handles (middle area) | `'shift'` | Shifts both by same delta, clamped to valid range |
| Outside bar (left of from) | `'from'` | Snap from-handle to clicked item |
| Outside bar (right of to) | `'to'` | Snap to-handle to clicked item |

Implementation pattern: `dragRef` holds `{ mode, startX, startFromIdx, startToIdx }`. Global `pointermove`/`pointerup` listeners update position via refs (no re-render per frame). `useState(activeDrag)` used only for cursor styling.

### Label density

- ≤ 7 items → show all labels.
- > 7 items → show every `Math.ceil(n / 7)` items + always show last.
- Labels with empty string from `formatLabel` are skipped.

### Traffic `formatLabel` example

```ts
(p: string) => {
  const [y, m] = p.split('-');
  if (m === '01') return y;          // show year at Jan boundary
  return '';                          // hide intermediate months
}
```

---

## URL state changes

Add `periodFrom` to `useMapState.ts` alongside existing `period`.

```ts
// New entries in useMapState return type:
periodFrom: string;
setPeriodFrom: (value: string) => void;
```

Reads/writes `?periodFrom=` URL search param (same pattern as existing `period`).

**Convention:**
- `periodFrom` = start of range
- `period` = end of range (existing param — traffic layer files keep reading this)

---

## Files to create

| File | Action |
|---|---|
| `frontend/src/components/city/map/modes/PeriodRangeTimeline.tsx` | **New** — the shared widget |
| `backend/database/migrations/016_accidents_tile_year_range.sql` | **New** — add `year_from`/`year_to` to Martin tile function |

---

## Files to modify

### Frontend

#### `frontend/src/hooks/useMapState.ts`
- Add `periodFrom: string` and `setPeriodFrom: (v: string) => void`.
- Reads `searchParams.get('periodFrom') ?? ''`.

#### `frontend/src/components/city/MapFilters.tsx`
- **Remove** `CompactYearTimeline` component entirely.
- **Remove** `showAccidentsTimeline` variable and its `{showAccidentsTimeline && ...}` JSX block.
- **Remove** `period` and `onPeriodChange` from `PillProps` interface and `ExpandingPill` params.
- **Remove** `fetchAccidentsSummary` import (no longer used here).
- **Remove** `ACCIDENT_ACCENT` constant.
- In `MapFilters`: remove `setPeriod` from `useMapState` destructuring; remove `period` and `onPeriodChange` from `ExpandingPill` call.

#### `frontend/src/components/city/map/modes/accidents/AccidentsStats.tsx`
- Import `PeriodRangeTimeline` from `../PeriodRangeTimeline`.
- Read `periodFrom` and `period` from `useMapState()`.
- Add `useEffect` to auto-initialise both to `String(latestYear)` when both are empty and `latestYear` is available.
- Replace `<YearTimeline .../>` with `<PeriodRangeTimeline items={yearStrings} from={periodFrom || defaultYear} to={period || defaultYear} onChange={(f, t) => { setPeriodFrom(f); setPeriod(t); }} accent={ACCENT} unit="año" />`.
- **Remove** `YearTimeline` component definition.
- **Remove** the "Año de datos" `MetricPill` (now inside the range widget header).
- Reduce MetricPill grid from 4 to 3 columns.
- Pass `yearFrom` and `yearTo` to `useAccidentsStats`.

#### `frontend/src/hooks/useAccidentsStats.ts`
- Change signature: `(cityId, yearFrom?: number, yearTo?: number)` (was `year?`).
- Update `fetchAccidents(cityId, true, yearFrom, yearTo)`.
- Update `fetchAccidentsSummary(cityId, yearFrom, yearTo)`.
- Update `useEffect` deps: `[cityId, yearFrom, yearTo]`.

#### `frontend/src/services/api.ts`
- `fetchAccidents`: replace `year?: number` with `yearFrom?: number, yearTo?: number`. Build URL with `year_from` and `year_to`.
- `fetchAccidentsSummary`: same change.

#### `frontend/src/components/city/map/modes/accidents/AccidentsLayer.tsx`
- Add `useMapState()` to read `periodFrom` and `period`.
- Derive `yearFrom`/`yearTo` from those params.
- Replace `tileParams.set('year', ...)` with `tileParams.set('year_from', ...)` and `tileParams.set('year_to', ...)`.
- Remove `year?: number` from `AccidentsLayerProps` (no longer needed as prop).

#### `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx`
- Import `PeriodRangeTimeline` from `../PeriodRangeTimeline`.
- Read `periodFrom`/`setPeriodFrom` from `useMapState()`.
- Replace `<PeriodDropdown .../>` with `<PeriodRangeTimeline items={availablePeriods} from={periodFrom || availablePeriods[0]} to={period || availablePeriods[availablePeriods.length-1]} onChange={(f,t)=>{ setPeriodFrom(f); setPeriod(t); }} accent={ACCENT} unit="mes" formatLabel={trafficLabel} />`.
- Define `trafficLabel = (p: string) => { const [y, m] = p.split('-'); return m === '01' || p === availablePeriods[0] || p === availablePeriods[availablePeriods.length-1] ? y : ''; }`.
- **Remove** `PeriodDropdown` component and `useState` import if unused.
- Grid layout: the `PeriodDropdown` was in a `grid-cols-3`. Move `PeriodRangeTimeline` to span full width (or `col-span-3`), keeping generation + routing in the remaining 2 cols.

### Backend

#### `backend/database/db_io/accidents.py`
- `get_accidents_geojson`: replace `year: Optional[int]` with `year_from: Optional[int], year_to: Optional[int]`. Update `WHERE` clause:
  ```sql
  AND (year_from IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INT >= %(year_from)s)
  AND (year_to   IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INT <= %(year_to)s)
  ```
- `get_accidents_summary`: same change.

#### `backend/api/routes.py`
- `/cities/{city_id}/accidents`: replace `year: Optional[int]` with `year_from: Optional[int] = Query(None)` and `year_to: Optional[int] = Query(None)`. Pass to `get_accidents_geojson`.
- `/cities/{city_id}/accidents/summary`: same change.

#### `backend/database/migrations/016_accidents_tile_year_range.sql`
Update the `accidents_tile` Martin function:
- Replace `target_year INTEGER` with `target_year_from INTEGER` and `target_year_to INTEGER`.
- Replace `NULLIF(query_params->>'year', '')::INTEGER` with two separate NULLIF casts.
- Update `WHERE` clause:
  ```sql
  AND (target_year_from IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INTEGER >= target_year_from)
  AND (target_year_to   IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INTEGER <= target_year_to)
  ```

---

## Default initialisation

**Accidents** — in `AccidentsStats.tsx`:
```ts
useEffect(() => {
  if (!period && !periodFrom && latestYear) {
    const yr = String(latestYear);
    setPeriod(yr);
    setPeriodFrom(yr);
  }
}, [latestYear, period, periodFrom]);
```

**Traffic** — the existing `TrafficRoutesLayer` logic already auto-sets `period` from the resolved result when empty:
```ts
if (!period && result.month) setPeriod(result.month);
```
Add similar for `periodFrom`: set to `availablePeriods[0]` when empty and periods are loaded.

---

## What does NOT change

- `TrafficRoutesLayer.tsx` — continues reading `period` (single period = end of range).
- `TrafficTripsLayer.tsx` — same.
- `AccidentsLegend.tsx` — unaffected.
- Martin `traffic_tile` function — unaffected.
- Mobile `MapFilters` layout — the horizontal pill strip has no period selector; no change needed.

---

## Testing checklist

- [ ] Year range in accidents: selecting 2021–2023 shows all 3 years on map tiles and in stats matrices.
- [ ] Default: on first load of accidents mode, `periodFrom = period = latestYear`.
- [ ] Traffic range: dragging shows monthly range; traffic layer still uses `period` (end) for route tiles.
- [ ] Shift drag: dragging the middle of the bar moves both handles together.
- [ ] Single-year state: when from == to, bar is minimal-width; handles overlap (to on top); clicking to the left of the bar expands start.
- [ ] `MapFilters.tsx` no longer shows year selector in Accidents pill.
- [ ] "Año de datos" MetricPill is gone; period is shown in the unified card header.
- [ ] MetricPill grid: 3 cols (total accidents, cyclist accidents, incidencia ciclista).
