# Transparency Mode — Design Spec

**Date:** 2026-06-06  
**Branch:** dev  

---

## Overview

Add a new `transparency` map mode to the CityPage that surfaces municipal budget data and the mayor timeline. Instead of an interactive map, the city's building layer is displayed as a locked decorative backdrop with the `BudgetSunburst` overlaid on top. The stats section below shows a year selector, budget summary metrics, a vertical delta chart (executed vs planned), and the mayor timeline.

The mode integrates into the existing layout without special-casing: it follows the same hero → mode pills → map slot → stats section structure on standard desktop, and the same `DualPanel` on ultrawide.

---

## 1. Mode Registration

### `frontend/src/constants/mapModes.ts`

Add:

```ts
TRANSPARENCY: 'transparency'
```

### `frontend/src/components/city/MapDesktop.tsx`

Add to `modeNames`:
```ts
[MAP_MODES.TRANSPARENCY]: 'Transparencia',
```

Add to `modeColors`:
```ts
[MAP_MODES.TRANSPARENCY]: '#3A6C7F',
```

Add to `modeGradients`:
```ts
[MAP_MODES.TRANSPARENCY]: { bg: 'linear-gradient(160deg, #1e2d5a 0%, #3A6C7F 100%)', wave: '#1e2d5a' },
```

The gradient uses `#1e2d5a` (deep indigo-navy) → `#3A6C7F` (`--blue`), distinct from the traffic gradient (`#003849` → `#4b749f`) while staying in the same palette family.

### `frontend/src/components/city/MapFilters.tsx`

Add to `MODE_META`:
```ts
{ id: MAP_MODES.TRANSPARENCY, name: 'Transparencia', color: '#3A6C7F', icon: Scales }
```

Use `Scales` from `@phosphor-icons/react` (the balance/justice icon — fitting for civic transparency).

Add to `CONTEXT_COPY`:
```ts
[MAP_MODES.TRANSPARENCY]: {
  title: 'Presupuesto y gobierno municipal',
  body: 'Explora cómo el ayuntamiento gestiona sus recursos. Compara lo presupuestado con lo ejecutado por área de gasto, y consulta el historial de mandatos municipales. Los datos provienen de los presupuestos municipales publicados.',
}
```

No submodes for this mode — no `VIZ_SUBMODES` entry needed.

---

## 2. Data Availability Gating

In `MapDesktop.isModeAvailable`, the `TRANSPARENCY` mode is available only when budget data exists for the city.

`MapDesktop` fetches three data sources in parallel via `Promise.all` on mount:
1. `fetchInfraStats(city.id)` — existing
2. `fetchCityBudgets(city.id)` → `budgetYears: BudgetYear[]` — new
3. `fetchCityContext(city.id)` → `mayors: MayorTerm[]` — new

If `budgetYears` is empty, `isModeAvailable(MAP_MODES.TRANSPARENCY)` returns false and the pill is hidden.

State lifted into `MapDesktop`:
- `budgetYears: BudgetYear[]`
- `selectedYear: number` (defaults to most recent year in array)
- `budgetType: 'planned' | 'executed'` (defaults to `'planned'`)

---

## 3. Map Slot — Locked Building Layer + Sunburst Overlay

### `CityMap` locked prop

`CityMap` receives a new optional `locked?: boolean` prop. When `true`:
- All pointer events on the map canvas are disabled (`pointer-events: none`)
- `onEdgeSelect` is never called
- The map initialises to the city's default viewport and does not respond to pan/zoom

`MapControls` and `CityLegend` both render inside `CityMap.tsx`. When `locked={true}`, `CityMap` skips rendering both — no changes needed outside `CityMap`.

### Sunburst overlay

Inside the map container div in `MapDesktop`, when `mode === MAP_MODES.TRANSPARENCY`, render `BudgetSunburst` as an absolute overlay:

```tsx
{mode === MAP_MODES.TRANSPARENCY && budgetYears.length > 0 && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
    <div className="pointer-events-auto w-[min(480px,90%)]">
      <BudgetSunburst
        data={buildSunburstTree(budgetYears, selectedYear, budgetType)}
        year={selectedYear}
        budgetType={budgetType}
        onBudgetTypeChange={setBudgetType}
      />
    </div>
  </div>
)}
```

`buildSunburstTree` is a pure helper (new, in `MapDesktop` or a `utils/budget.ts` file) that converts `BudgetYear[]` + a selected year + budget type into the `BudgetNode` tree that `BudgetSunburst` expects. It groups `lines` by `category_code` prefix to form a two-level hierarchy (top-level category → sub-categories).

The map container div must be `position: relative` (it already uses a fixed height class — add `relative` if not present).

---

## 4. Stats Section — `TransparencyStats` Component

New file: `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx`

### Props

```ts
interface TransparencyStatsProps {
  city: CityData;
  budgetYears: BudgetYear[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  budgetType: 'planned' | 'executed';
  onBudgetTypeChange: (t: 'planned' | 'executed') => void;
  mayors: MayorTerm[];
}
```

### Layout (top to bottom)

**1. Year selector — `PeriodRangeTimeline`**

Items: `budgetYears.map(y => String(y.year))`, sorted ascending.  
From and to both set to `String(selectedYear)`.  
`onChange(from, _to)` calls `onYearChange(Number(from))` — single-point selection enforced by always setting both handles to the same value on change.  
Accent: `#3A6C7F`.  
Unit: `'año'`.

**2. Summary metric cards**

Three `GlassCard` items in a row for the selected year's `BudgetYear`:
- **Ingresos totales** — `total_income` (formatted with `formatCurrency`)
- **Gastos totales** — `total_expenses`
- **Deuda pública** — `public_debt`

Null values render `'—'`. Uses existing `formatCurrency` util.

**3. `BudgetDeltaChart` — new component**

File: `frontend/src/components/city/plots/BudgetDeltaChart.tsx`

A vertical diverging bar chart:
- **X axis:** top-level budget categories (grouped by `category_code` prefix from `lines[]`)
- **Y axis:** delta amount = executed − planned for each category
- **Bars above zero** (overspent): `var(--red)`
- **Bars below zero** (underspent): `#3A6C7F` (`--blue`)
- **Zero baseline:** drawn as a horizontal line
- Tooltip on hover: category name, planned amount, executed amount, delta, delta %
- Built with `d3-scale` (linear Y, band X) + SVG, same ResizeObserver pattern as `MayorsGanttChart`
- If either planned or executed data is missing for the selected year, renders an empty state

Data derivation: from the selected `BudgetYear`, group `lines` by `budget_type`. For each top-level category code (first character or prefix of `category_code`), sum planned and executed separately, then compute delta.

**4. `MayorsGanttChart`**

Existing component, no changes. Receives `mayors` from `fetchCityContext`.

### Rendering in `MapDesktop`

`TransparencyStats` requires props that no other mode needs (`budgetYears`, `selectedYear`, `onYearChange`, `budgetType`, `onBudgetTypeChange`, `mayors`). Rather than polluting `ModeStatsRouter`'s interface, `MapDesktop` renders `TransparencyStats` directly when `mode === MAP_MODES.TRANSPARENCY`, and falls back to `ModeStatsRouter` for all other modes:

```tsx
const statsEl = mode === MAP_MODES.TRANSPARENCY
  ? (
    <TransparencyStats
      city={city}
      budgetYears={budgetYears}
      selectedYear={selectedYear}
      onYearChange={setSelectedYear}
      budgetType={budgetType}
      onBudgetTypeChange={setBudgetType}
      mayors={mayors}
    />
  )
  : <ModeStatsRouter city={city} />;
```

`ModeStatsRouter` is unchanged.

---

## 5. Ultrawide (DualPanel)

No change to the dual-panel branching logic. When `isUltrawide` and mode is `TRANSPARENCY`:
- **Left:** `CityMap` with `locked={true}` + sunburst overlay (sticky, same container)
- **Right:** `MapFilters` + `TransparencyStats` (scrollable)

This falls out naturally from the existing structure — no special casing needed.

---

## 6. File Summary

| Action | File |
|---|---|
| Modify | `frontend/src/constants/mapModes.ts` |
| Modify | `frontend/src/components/city/MapDesktop.tsx` |
| Modify | `frontend/src/components/city/MapFilters.tsx` |
| Modify (no change) | `frontend/src/components/city/ModeStatsRouter.tsx` — untouched |
| Modify | `frontend/src/components/city/CityMap.tsx` |
| New | `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx` |
| New | `frontend/src/components/city/plots/BudgetDeltaChart.tsx` |
| New (optional) | `frontend/src/utils/budget.ts` (buildSunburstTree helper) |

---

## 7. Out of Scope

- Mobile layout (`MapMobile`) — transparency mode not added to mobile in this iteration
- Backend changes — all data already served by existing `/context` and `/budgets` endpoints
- Year range aggregation in the sunburst — single year only, no multi-year rollup
