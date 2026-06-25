# Dynamic category highlight + expense evolution chart (transparency mode)

**Date:** 2026-06-15
**Status:** Approved design — ready for implementation plan

## Summary

In transparency mode, replace the hardcoded mobility highlight set on the budget
sunburst with a user-driven selection, and add a new "expense evolution over time"
line chart for the selected categories. The planned/executed toggle is removed in
favour of an automatic per-year resolution (executed when available, otherwise
planned), simplifying the controls.

The freed slot next to the year timeline (previously the "Tipo de presupuesto"
card) becomes a new control container: a search bar over a scrollable, tickable
list of budget categories. The selection drives both the sunburst highlights
(overlay on the map) and the new evolution chart (in the stats column).

## Goals

- Let users choose which budget categories are highlighted on the sunburst,
  defaulting to the current mobility set (`MOBILITY_CODES`).
- Show how the selected categories' spending evolves over the available years,
  one line per selected category.
- Remove the planned/executed toggle from transparency mode; resolve the budget
  type automatically per year.

## Non-goals

- No change to the sunburst's visual highlight treatment. It keeps the same
  uniform green shading (subtle depth-based opacity), icons **only** for the known
  mobility default codes, and hover-to-highlight via the legend. We only swap the
  static `MOBILITY_CODES` source for the dynamic selected set.
- `GeneralContext` (the general city overview) keeps its own local planned/executed
  toggle and is **not** modified.
- No aggregation across categories: the evolution chart draws each selected
  category's own line. Ticking a parent and a child simply yields two independent
  lines (each is that code's own stated total per year).

## Architecture

### Shared selection state

`MapDesktop` and `MapMobile` own a new `highlightCodes: Set<string>` state,
initialized to `MOBILITY_CODES`, with a setter `setHighlightCodes`.

It flows to two places:

1. **`BudgetSunburst` overlay** — passed as the existing `mobilityHighlight` prop.
   No rendering change beyond the source becoming dynamic.
2. **`TransparencyStats`** — via the `transparencyData` object
   (`MapSheetContent.TransparencyDataProps`), threaded through `ModeStatsRouter`.

### Removing the planned/executed toggle

- The "Tipo de presupuesto" card in `TransparencyStats` is removed; its 1/3-width
  slot next to the year timeline is reused for the new control container.
- `budgetType` is no longer user-controlled state in `MapDesktop`/`MapMobile`.
  Instead a helper resolves it:

  ```
  resolveBudgetType(yearData): 'executed' | 'planned'
    → 'executed' if yearData has any executed lines, else 'planned'
  ```

  Resolved **per year**. For the sunburst (single selected year) the resolved type
  for `selectedYear` is used. The evolution chart resolves the type independently
  for each year it plots.
- `BudgetSunburst` gains `showBudgetTypeToggle?: boolean` (default `true`).
  Transparency passes `false` (and the resolved `budgetType`), which hides only the
  planned/executed buttons while keeping the category focus buttons
  (TODOS / area buttons). `GeneralContext` keeps the default `true`.

### Control container — `CategoryHighlightControl` (new component)

A card placed in the freed 1/3-width slot in `TransparencyStats`, styled to match
the surrounding cards (accent `#3A6C7F`, dark-tint variant).

- **Options**: the union of all `{ code, name }` that appear in any year's lines
  across `budgetYears`, deduped, sorted by `code`. Using the union (rather than the
  selected year's lines) keeps the list stable when the year changes. Names come
  from the first line that supplies a non-null `category_name`, falling back to the
  code.
- **Search bar**: filters the list by name (case-insensitive) or code substring.
- **Scrollable list**: each row is a checkbox + category name (code shown subtly).
  Mobility default codes are pre-ticked via the initial `highlightCodes`.
- **Behaviour**: ticking/unticking calls `onHighlightChange(nextSet)`. No hard cap
  on the number of selections.

### Evolution chart — `CategoryEvolutionChart` (new component)

A thin wrapper that builds the data/series for the existing `LineAreaChart` and
renders it.

- **Data**: one row per year present in `budgetYears`, shape
  `{ year: number, [code: string]: number }`, where each selected code's value is
  that code's line amount for the year using `resolveBudgetType(yearData)`. Missing
  code in a given year → value omitted (line gap).
- **Series**: one entry per selected code, `{ key: code, label: name, color, type:
  'line' }`. Colors assigned from a stable palette by selection order (reuse the
  sunburst palette `SUNBURST_COLORS`).
- **Render**: `LineAreaChart` with `xKey="year"`, `variant="darkTint"`,
  `accent="#3A6C7F"`, a title/subtitle, and help content matching the existing
  QUÉ VES / POR QUÉ IMPORTA / METODOLOGÍA pattern.
- **Placement**: in the budget section of `TransparencyStats`, directly after
  `BudgetDeltaChart`.
- **Empty state**: when no categories are selected, render a friendly placeholder
  prompting the user to pick categories instead of an empty chart.

### Pure helpers (in `utils/budget.ts`)

- `resolveBudgetType(yearData: BudgetYear): 'executed' | 'planned'`
- `buildCategorySeries(budgetYears: BudgetYear[], codes: string[]): { rows, names }`
  — returns the `{ year, [code]: amount }` rows and a `code → name` map, applying
  per-year type resolution. (The component maps these into `LineAreaChart` series.)

## Data flow

```
MapDesktop / MapMobile
  highlightCodes (state, init = MOBILITY_CODES)
  budgetType = resolveBudgetType(yearData for selectedYear)
    │
    ├── BudgetSunburst (overlay)
    │     mobilityHighlight = highlightCodes
    │     showBudgetTypeToggle = false
    │     budgetType = resolved
    │
    └── transparencyData → ModeStatsRouter → TransparencyStats
          ├── CategoryHighlightControl
          │     options = union of categories across budgetYears
          │     selected = highlightCodes
          │     onChange = setHighlightCodes
          └── CategoryEvolutionChart
                budgetYears + highlightCodes
                → buildCategorySeries → LineAreaChart
```

## Affected files

- `frontend/src/components/city/MapDesktop.tsx` — add `highlightCodes` state, derive
  `budgetType`, drop `setBudgetType` user control, wire new props.
- `frontend/src/components/city/MapMobile.tsx` — same as desktop.
- `frontend/src/components/city/MapSheetContent.tsx` — update `TransparencyDataProps`
  (remove `budgetType`/`onBudgetTypeChange`, add `highlightCodes`/`onHighlightChange`).
- `frontend/src/components/city/ModeStatsRouter.tsx` — thread the new props through.
- `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx` —
  remove budget-type card, add `CategoryHighlightControl` and `CategoryEvolutionChart`.
- `frontend/src/components/city/plots/BudgetSunburst.tsx` — add
  `showBudgetTypeToggle` prop; legend already renders from the highlight set
  (verify names resolve from the tree for non-mobility codes; icons stay
  mobility-only).
- `frontend/src/components/city/plots/CategoryEvolutionChart.tsx` — new.
- `frontend/src/components/city/map/modes/transparency/CategoryHighlightControl.tsx` —
  new.
- `frontend/src/utils/budget.ts` — add `resolveBudgetType`, `buildCategorySeries`.
- `GeneralContext.tsx` — unchanged (keeps its own toggle).

## Testing

- Unit tests (TDD) for the pure helpers in `utils/budget.ts`:
  - `resolveBudgetType` — prefers executed, falls back to planned, handles a year
    with only planned lines, and a year with no lines.
  - `buildCategorySeries` — correct per-year amounts per code, per-year type
    resolution, missing-code gaps, empty selection.
- Manual/visual verification of the control container, sunburst highlight
  switching, and the evolution chart in transparency mode (desktop + mobile).

## Open questions / risks

- The legend in `BudgetSunburst` currently sources names from `MOBILITY_LEGEND`.
  For dynamic non-mobility codes it must resolve the name from the budget tree
  (`findNode`) and omit the icon. Verify during implementation.
- `LineAreaChart` formats tooltip values with `fmtInt`; euro amounts are large but
  render acceptably as integers. A euro-formatted tooltip is a possible follow-up,
  not in scope here.
