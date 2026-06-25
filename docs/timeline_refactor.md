# Period Range Timeline — Refactor Plan

## Goal

Replace single-year/period selectors with a unified draggable range widget, shared by Accidents and Traffic stats panels. Remove the year selector from `MapFilters.tsx`. All backend and tile endpoints that previously accepted a single `year` or `month` parameter are updated to accept a range.

---

## User requirements

1. Delete year selector from the Accidents expanding pill in `MapFilters.tsx` — the pill's expandable row now shows the **bike / all** submode toggle instead.
2. Replace the current `YearTimeline` (click to select one year) with a **draggable range bar**:
   - A thick colored line represents the selected period.
   - The **left end** is a vertical capsule grip → changes start of range.
   - The **right end** is a vertical capsule grip → changes end of range.
   - **Dragging the bar itself** (middle) shifts the whole period.
   - No circles — grips are 6×22px vertical rounded rectangles with three 1px horizontal grip lines, accent-colored with subtle shadow.
   - Minimum range = 1 step (from and to must differ; you cannot drag them onto the same item).
   - Dragging clamps correctly: end cannot cross start and vice-versa.
   - **Debounce 400 ms** after the last pointer interaction before firing `onChange` — prevents rapid API calls during drag.
   - Default: last available year/period selected for both ends (but see Default Initialisation).
3. Apply the same widget to the **Traffic stats** panel (`PeriodDropdown` → range bar).
4. The period control is a **unified card** (header + track):
   - Header: calendar icon + big range value (e.g. `2021 – 2023`) + sublabel (`Período · 3 años` / `Período · 3 meses`).
   - Below divider: the draggable track.
5. Accidents and traffic use **separate URL params** to avoid cross-mode contamination.

---

## New component: `PeriodRangeTimeline`

**File:** `frontend/src/components/city/map/modes/PeriodRangeTimeline.tsx`

### Props

```ts
interface Props {
  items: string[];           // sorted array of valid values (years "YYYY" or months "YYYY-MM")
  from: string;              // currently selected start
  to: string;                // currently selected end
  onChange: (from: string, to: string) => void;  // debounced 400 ms
  accent: string;            // brand color for bar + grips
  unit?: string;             // default 'año' — used for sublabel ("3 años")
  formatLabel?: (item: string) => string; // optional label formatter for tick marks
}
```

### Layout (52px track height, full-width card)

```
[Card — rounded-2xl border bg-white/80 backdrop-blur-sm]
  [Header row — px-4 pt-4 pb-3]
    [Calendar icon 32×32, accent gradient]
    [Range value 2xl bold, e.g. "2021 – 2023"]
    [Sublabel 10px opacity-70, e.g. "Período · 3 años"]
  [1px divider]
  [Track — 52px tall, px-4 pb-4]
    ── gray bg 2px line, vertically centered
    ████████ thick bar 10px rounded, accent color
    ▐        left grip: 6×22px rounded rect, accent, shadow — at fromIdx position
         ▐   right grip: 6×22px rounded rect, accent, shadow — at toIdx position
    ||||||||  tick marks 2×6px per item, white if in-range
    2019 2023 labels 9px below ticks
```

Grip visual: `border-radius: 3px`, 3 horizontal lines of 1px × 3px spaced 3px apart inside the grip (CSS rendered, white/70).

### Drag logic

Three drag modes detected on `pointerdown`:

| Click zone | Mode | Behavior |
|---|---|---|
| Within 16px of left grip center-x | `'from'` | Moves start, clamped to < toIdx |
| Within 16px of right grip center-x | `'to'` | Moves end, clamped to > fromIdx |
| Between grips (at least 16px from either) | `'shift'` | Shifts both by same delta, clamped to valid range |
| Left of from grip (outside bar) | `'from'` | Snap from to clicked item (if < toIdx) |
| Right of to grip (outside bar) | `'to'` | Snap to to clicked item (if > fromIdx) |

Implementation: `dragRef` holds `{ mode, startX, startFromIdx, startToIdx }`. Global `pointermove`/`pointerup` listeners update via refs (no re-render per frame). `useState(activeDrag)` for cursor styling only. `onPointerUp` fires the debounced `onChange`.

Minimum range enforcement: when moving `from`, clamp to `Math.min(candidateIdx, toIdx - 1)`. When moving `to`, clamp to `Math.max(candidateIdx, fromIdx + 1)`. For `shift`, stop when either end would violate bounds.

### Debounce

Use `useRef` for a debounce timer. On each `pointerup` (or programmatic change), clear any pending timer and schedule `onChange(from, to)` in 400 ms. If the user starts a new drag before 400 ms, the old timer is cancelled.

### Label density

- ≤ 7 items → show all labels.
- > 7 items → show every `Math.ceil(n / 7)` items + always show last.
- Labels with empty string from `formatLabel` are skipped (no tick label, tick mark still shown).

### Traffic `formatLabel`

```ts
const trafficLabel = (p: string) => {
  const [y, m] = p.split('-');
  if (m === '01' || p === availablePeriods[0] || p === availablePeriods[availablePeriods.length - 1]) return y;
  return '';
};
```

---

## URL state changes

### Accidents — new params (separate from traffic)

Add `yearFrom` and `yearTo` to `useMapState.ts`:

```ts
yearFrom: string;   // reads ?yearFrom= (e.g. "2021")
yearTo: string;     // reads ?yearTo=   (e.g. "2023")
setYearFrom: (value: string) => void;
setYearTo: (value: string) => void;
```

`AccidentsLayer` and `AccidentsStats` read `yearFrom`/`yearTo`. The existing `period` param is no longer used by accidents.

### Traffic — new param

Add `periodFrom` to `useMapState.ts`:

```ts
periodFrom: string;   // reads ?periodFrom= (e.g. "2022-01")
setPeriodFrom: (value: string) => void;
```

`period` = end of range (existing param, kept). `periodFrom` = start of range.

All traffic calls that currently receive a single `period` now receive `periodFrom` (start) and `period` (end).

---

## Files to create

| File | Action |
|---|---|
| `frontend/src/components/city/map/modes/PeriodRangeTimeline.tsx` | **New** — the shared widget |
| `backend/database/migrations/016_accidents_tile_year_range.sql` | **New** — update accidents_tile function |
| `backend/database/migrations/017_traffic_tile_month_range.sql` | **New** — update edges_with_traffic function |

---

## Files to modify

### Frontend

#### `frontend/src/hooks/useMapState.ts`
- Add `yearFrom`, `yearTo`, `setYearFrom`, `setYearTo` (reads/writes `?yearFrom=`, `?yearTo=`).
- Add `periodFrom`, `setPeriodFrom` (reads/writes `?periodFrom=`).
- Same URL-param pattern as existing `period`.

#### `frontend/src/components/city/MapFilters.tsx`
- **Remove** `CompactYearTimeline` component definition.
- **Remove** `showAccidentsTimeline` variable and its JSX block.
- **Remove** `period` and `onPeriodChange` from `PillProps` and `ExpandingPill` params.
- **Remove** `fetchAccidentsSummary` import, `ACCIDENT_ACCENT` constant.
- In `MapFilters`, remove `setPeriod` from `useMapState` destructuring; remove `period` and `onPeriodChange` from `ExpandingPill` call.
- **Add** submode support for Accidents mode in `VIZ_SUBMODES`:
  ```ts
  [MAP_MODES.ACCIDENTS]: {
    items: [
      { id: 'bike', label: 'Bicicleta' },
      { id: 'all',  label: 'Todos' },
    ],
  },
  ```
  This moves the bike/all toggle into the pill's expandable row (same pattern as Traffic's rutas/od toggle).
- Remove `[MAP_MODES.ACCIDENTS] defaultSubmode` if it was set separately — now handled by VIZ_SUBMODES.

#### `frontend/src/components/city/map/modes/index.ts`
- Remove `year?: number` from `ModeConfig.layer` type signature (AccidentsLayer will read state internally).

#### `frontend/src/components/city/map/modes/accidents/AccidentsStats.tsx`
- **Layout change**: `PeriodRangeTimeline` card at top, then header toggle, then 3-col MetricPill grid, then matrices.
- Import `PeriodRangeTimeline`.
- Read `yearFrom`, `yearTo`, `setYearFrom`, `setYearTo` from `useMapState()`.
- Add `useEffect` to auto-initialise both to `String(latestYear)` when both are empty and `latestYear` is available:
  ```ts
  useEffect(() => {
    if (!yearTo && !yearFrom && latestYear) {
      const yr = String(latestYear);
      setYearTo(yr);
      setYearFrom(yr);
    }
  }, [latestYear, yearTo, yearFrom]);
  ```
- Replace `<YearTimeline .../>` with:
  ```tsx
  <PeriodRangeTimeline
    items={availableYears.map(String)}
    from={yearFrom || String(latestYear ?? '')}
    to={yearTo || String(latestYear ?? '')}
    onChange={(f, t) => { setYearFrom(f); setYearTo(t); }}
    accent={ACCENT}
    unit="año"
  />
  ```
- **Remove** the "Año de datos" `MetricPill` (period shown in widget header).
- Change MetricPill grid from `grid-cols-2 sm:grid-cols-4` to `grid-cols-3`.
- **Remove** `YearTimeline` component definition, submode toggle header (it moves to MapFilters pill).
- Pass `yearFrom`/`yearTo` to `useAccidentsStats` as numbers.

#### `frontend/src/hooks/useAccidentsStats.ts`
- Change signature: `(cityId, yearFrom?: number, yearTo?: number)` (was `year?`).
- Update `fetchAccidents(cityId, true, yearFrom, yearTo)`.
- Update `fetchAccidentsSummary(cityId, yearFrom, yearTo)`.
- Update `fetchVehiclePairStats(cityId, yearFrom, yearTo)`.
- Update `useEffect` deps: `[cityId, yearFrom, yearTo]`.

#### `frontend/src/services/api.ts`

Accidents:
- `fetchAccidents`: replace `year?: number` with `yearFrom?: number, yearTo?: number`. Build URL with `year_from` / `year_to`.
- `fetchAccidentsSummary`: same change.
- `fetchVehiclePairStats`: same change.

Traffic:
- `fetchTrafficResolve`: add `monthFrom?: string` param. Passes `month_from` query param.
- `fetchTrafficInfraCoverage`: add `monthFrom?: string`. Passes `month_from`.
- `fetchODFlows`: add `periodFrom?: string`. Passes `period_from`.
- `EdgeRoutesParams`: add `monthFrom?: string`. Route: passes `month_from`.
- `fetchTraffic`: add `monthFrom?: string`. Passes `month_from` (for consistency; may not be used yet).

#### `frontend/src/components/city/map/modes/accidents/AccidentsLayer.tsx`
- Remove `year` from `AccidentsLayerProps` (no longer a prop).
- Import `useMapState` and read `yearFrom`, `yearTo`.
- Derive `yearFromNum`/`yearToNum` via `parseInt`.
- Replace `tileParams.set('year', ...)` with `tileParams.set('year_from', ...)` and `tileParams.set('year_to', ...)`.
- Update `useEffect` dep array to `[..., yearFrom, yearTo, ...]`.

#### `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx`
- Import `PeriodRangeTimeline`.
- Read `periodFrom`, `setPeriodFrom` from `useMapState()`.
- **Layout**: Move `PeriodRangeTimeline` above the filter cards as a full-width element. Change filter cards grid to `grid-cols-2` (generation + routing only).
- Replace `<PeriodDropdown .../>` with:
  ```tsx
  <PeriodRangeTimeline
    items={availablePeriods}
    from={periodFrom || availablePeriods[0] || ''}
    to={period || availablePeriods[availablePeriods.length - 1] || ''}
    onChange={(f, t) => { setPeriodFrom(f); setPeriod(t); }}
    accent={ACCENT}
    unit="mes"
    formatLabel={trafficLabel}
  />
  ```
- Define `trafficLabel` (see above).
- Add `useEffect` to initialise `periodFrom` when empty and `availablePeriods` loads:
  ```ts
  useEffect(() => {
    if (!periodFrom && availablePeriods.length > 0) setPeriodFrom(availablePeriods[0]);
  }, [availablePeriods, periodFrom]);
  ```
- Pass `periodFrom` to `fetchTrafficInfraCoverage`.
- **Remove** `PeriodDropdown` component definition.
- **Remove** `useState` import if no longer needed.

#### `frontend/src/components/city/map/modes/traffic/TrafficRoutesLayer.tsx`
- Read `periodFrom` from `useMapState()`.
- Pass `monthFrom: periodFrom || undefined` to `fetchTrafficResolve`.
- Pass `monthFrom: periodFrom || undefined` to `fetchEdgeRoutes`.
- When building tile URL, add `tileParams.set('month_from', resolvedFrom)` alongside existing `month`.
- Update `useEffect` dep arrays to include `periodFrom`.

#### `frontend/src/components/city/map/modes/traffic/TrafficTripsLayer.tsx`
- Read `periodFrom` from `useMapState()`.
- Pass `periodFrom: period || undefined` as `periodFrom` to `fetchODFlows`.
- Update dep array for `loadData` and the relevant `useEffect`.

#### `frontend/src/hooks/useLiveStats.ts`
- Pass `periodFrom || undefined` as `monthFrom` to `fetchTrafficResolve` and `fetchTrafficInfraCoverage`.

---

### Backend

#### `backend/database/db_io/accidents.py`

All three functions change `year: Optional[int]` → `year_from: Optional[int], year_to: Optional[int]`:

- `get_accidents_geojson`:
  ```sql
  AND (%(year_from)s IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INT >= %(year_from)s)
  AND (%(year_to)s   IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INT <= %(year_to)s)
  ```
- `get_accidents_summary`: same WHERE change.
- `get_vehicle_pair_severity`: same WHERE change (in the `JOIN accidents a` clause).

#### `backend/api/routes.py`

Accidents routes — replace `year: Optional[int] = Query(None)` with:
```python
year_from: Optional[int] = Query(None, description="Start year (inclusive)")
year_to:   Optional[int] = Query(None, description="End year (inclusive)")
```
Applied to:
- `GET /cities/{city_id}/accidents`
- `GET /cities/{city_id}/accidents/summary`
- `GET /cities/{city_id}/accidents/pair-stats`

Traffic routes — add `month_from: Optional[str] = Query(None, description="Start month YYYY-MM")` to:
- `GET /cities/{city_id}/traffic`
- `GET /cities/{city_id}/traffic/resolve`
- `GET /cities/{city_id}/traffic/infra-coverage`
- `GET /cities/{city_id}/edges/{edge_id}/routes`

OD flows:
- `GET /cities/{city_id}/trips/od-flows` — add `period_from: Optional[str] = Query(None)`

Pass these new params through to the corresponding `db_io` functions.

#### `backend/database/db_io/traffic.py`

Functions that need month range support:
- `get_edge_traffic(conn, city_id, ..., month, ...)` → add `month_from`. The WHERE clause changes from `AND et.month = month_val` to:
  ```sql
  AND et.month >= %(month_from)s
  AND et.month <= %(month_to)s
  ```
  Aggregate with `SUM(trip_count)` grouped by edge.
- `resolve_traffic_params`: accept `month_from`; if provided, resolve against that range. The "latest" resolution still applies to `month_to`.
- `get_traffic_infra_coverage`: accept `month_from`; aggregate routes over the range.
- `get_od_hex_flows`: accept `period_from`; aggregate flows over the range.
- `get_traffic_stats`: accept `month_from`; compute percentile stats over the range.

#### `backend/database/migrations/016_accidents_tile_year_range.sql`

Update `accidents_tile` Martin function:
- Replace `target_year INTEGER` with `target_year_from INTEGER` and `target_year_to INTEGER`.
- Replace `NULLIF(query_params->>'year', '')::INTEGER` with two `NULLIF` casts.
- Replace `AND (target_year IS NULL OR ... = target_year)` with:
  ```sql
  AND (target_year_from IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INTEGER >= target_year_from)
  AND (target_year_to   IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INTEGER <= target_year_to)
  ```

#### `backend/database/migrations/017_traffic_tile_month_range.sql`

Update `edges_with_traffic` Martin function:
- Replace `month_val DATE` with `month_from_val DATE` and `month_to_val DATE`.
- Replace `NULLIF(query_params->>'month', '')::DATE` with two separate casts.
- Replace `AND et.month = month_val` with:
  ```sql
  AND et.month >= month_from_val
  AND et.month <= month_to_val
  ```
- Change `trip_count` aggregation from per-month value to `SUM(trip_count) AS trip_count` grouped by edge.

---

## Default initialisation

**Accidents** — in `AccidentsStats.tsx`:
```ts
useEffect(() => {
  if (!yearTo && !yearFrom && latestYear) {
    const yr = String(latestYear);
    setYearTo(yr);
    setYearFrom(yr);
  }
}, [latestYear, yearTo, yearFrom]);
```

**Traffic** — existing auto-set for `period` (from `TrafficRoutesLayer` resolve) stays unchanged. Add in `TrafficStats.tsx`:
```ts
useEffect(() => {
  if (!periodFrom && availablePeriods.length > 0) setPeriodFrom(availablePeriods[0]);
}, [availablePeriods, periodFrom]);
```

---

## Placement summary

### AccidentsStats.tsx layout (top to bottom)

1. `<PeriodRangeTimeline>` (full width, replaces old YearTimeline)
2. `<div>` header with title "Siniestralidad Vial" *(submode toggle moves to MapFilters pill)*
3. `<div className="grid grid-cols-3">` — 3 MetricPills (total, cyclist, incidencia)
4. Stacked bar matrices (`grid-cols-1 lg:grid-cols-2`)
5. Weather + Collision heatmap (`grid-cols-2`)

### TrafficStats.tsx layout (top to bottom)

1. `<PeriodRangeTimeline>` (full width, replaces PeriodDropdown)
2. `<div>` header with title "Tráfico Ciclista"
3. `<div className="grid grid-cols-2">` — Generación + Enrutamiento filter cards
4. Row 1 MetricPills (2 cols)
5. Row 2 MetricPills (2 cols)
6. `<LineAreaChart>` evolution (conditional)

### MapFilters.tsx — Accidents pill

The Accidents expanding pill now shows the bike/all submode toggle (same pattern as Traffic's rutas/od row). No year/period control lives in MapFilters.

---

## What does NOT change

- `AccidentsLegend.tsx` — unaffected.
- Mobile `MapFilters` layout — horizontal pill strip has no expandable rows; no change needed.
- `TrafficLegend.tsx` — unaffected.
- `StaticCityMap.tsx` — calls `fetchTrafficResolve` without month range (compare view, uses latest); no change needed.
- `RouteHistograms.tsx` — calls `fetchTrafficInfraCoverage` without period; aggregate view; no change needed.

---

## Testing checklist

- [ ] Year range in accidents: selecting 2021–2023 shows all 3 years on map tiles and in stats.
- [ ] Default: on first load of accidents mode, `yearFrom = yearTo = latestYear`.
- [ ] Traffic range: dragging shows monthly range; tile aggregates trip counts across months.
- [ ] Shift drag: dragging the middle of the bar moves both grips together.
- [ ] Minimum range: cannot drag grips onto the same item; end always > start.
- [ ] 400 ms debounce: rapid drags do not fire multiple API calls; only the final position triggers a fetch.
- [ ] `MapFilters.tsx` Accidents pill: shows bike/all submode toggle, not year selector.
- [ ] "Año de datos" MetricPill is gone; period shown in unified card header.
- [ ] MetricPill grid: 3 cols (total, cyclist, incidencia).
- [ ] Traffic range: selecting `2022-01 → 2023-06` shows aggregated tile counts for that span.
- [ ] Switching from accidents mode to traffic mode: `yearFrom`/`yearTo` params do not contaminate traffic `periodFrom`/`period`.
- [ ] `fetchVehiclePairStats` respects year range (collision heatmap and pedestrian matrix filter to selected years).
- [ ] TrafficTripsLayer (OD mode) reloads flows when period range changes.
- [ ] `useLiveStats` traffic stats reflect the period range.
