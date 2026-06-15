# Dynamic Category Highlight + Expense Evolution Chart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In transparency mode, let users choose which budget categories are highlighted on the sunburst, add a per-category "expense evolution over time" line chart, and remove the planned/executed toggle in favour of an automatic per-year resolution.

**Architecture:** A shared `highlightCodes: Set<string>` selection lives in the map containers (`MapDesktop`/`MapMobile`) and the `ModeStatsRouter` fallback. It drives the existing `BudgetSunburst` overlay (dynamic `mobilityHighlight`) and `TransparencyStats`, which renders a new search-and-tick control container plus a new evolution chart (reusing `LineAreaChart`). Budget type is no longer user-selected; a pure helper resolves it per year (executed when available, else planned).

**Tech Stack:** React + TypeScript, Vite, Vitest, d3, Tailwind, Phosphor icons.

**Spec:** `docs/superpowers/specs/2026-06-15-category-highlight-evolution-design.md`

---

## File Structure

**New files:**
- `frontend/src/utils/budget.test.ts` — unit tests for the new pure helpers.
- `frontend/src/components/city/plots/CategoryEvolutionChart.tsx` — wrapper that builds series and renders `LineAreaChart`.
- `frontend/src/components/city/map/modes/transparency/CategoryHighlightControl.tsx` — search + scrollable tickable category list.

**Modified files:**
- `frontend/src/utils/budget.ts` — add `resolveBudgetType`, `buildCategoryOptions`, `buildCategorySeries`.
- `frontend/src/components/city/plots/BudgetSunburst.tsx` — export `SUNBURST_COLORS`; add `showBudgetTypeToggle` prop; make the highlight legend render from the dynamic `mobilityHighlight` set.
- `frontend/src/components/city/MapSheetContent.tsx` — swap `budgetType`/`onBudgetTypeChange` for `highlightCodes`/`onHighlightChange` in `TransparencyDataProps`.
- `frontend/src/components/city/ModeStatsRouter.tsx` — thread the new props through both the `transparencyData` path and the `TransparencyContainer` fallback.
- `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx` — swap props; remove the budget-type card; add the control container and evolution chart.
- `frontend/src/components/city/MapDesktop.tsx` — add `highlightCodes` state, derive `budgetType`, wire props (two `TransparencyStats` call sites + the sunburst overlay).
- `frontend/src/components/city/MapMobile.tsx` — same as desktop (one sunburst overlay + the `transparencyData` object).

**Verification commands** (run from `frontend/`):
- Typecheck: `npx tsc -b`
- Tests: `npx vitest run src/utils/budget.test.ts`

---

## Task 1: Pure budget helpers

**Files:**
- Modify: `frontend/src/utils/budget.ts`
- Test: `frontend/src/utils/budget.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveBudgetType, buildCategoryOptions, buildCategorySeries } from './budget';
import type { BudgetYear } from '../services/api';

const year2022: BudgetYear = {
  year: 2022,
  total_income: null, total_expenses: null, public_debt: null,
  lines: [
    { category_code: '133', category_name: 'Tráfico',   amount: 100, budget_type: 'planned' },
    { category_code: '133', category_name: 'Tráfico',   amount: 90,  budget_type: 'executed' },
    { category_code: '44',  category_name: 'Transporte', amount: 200, budget_type: 'planned' },
    { category_code: '44',  category_name: 'Transporte', amount: 180, budget_type: 'executed' },
  ],
};

// Latest year: only planned available (e.g. budget approved, not yet executed)
const year2023: BudgetYear = {
  year: 2023,
  total_income: null, total_expenses: null, public_debt: null,
  lines: [
    { category_code: '133', category_name: 'Tráfico', amount: 110, budget_type: 'planned' },
    // note: no '44' line this year, and no executed lines at all
  ],
};

describe('resolveBudgetType', () => {
  it('prefers executed when present', () => {
    expect(resolveBudgetType(year2022)).toBe('executed');
  });
  it('falls back to planned when no executed lines', () => {
    expect(resolveBudgetType(year2023)).toBe('planned');
  });
  it('returns planned for empty or missing year', () => {
    expect(resolveBudgetType({ ...year2022, lines: [] })).toBe('planned');
    expect(resolveBudgetType(null)).toBe('planned');
  });
});

describe('buildCategoryOptions', () => {
  it('returns the deduped union of codes across years, sorted by code', () => {
    const opts = buildCategoryOptions([year2023, year2022]);
    expect(opts).toEqual([
      { code: '133', name: 'Tráfico' },
      { code: '44',  name: 'Transporte' },
    ]);
  });
  it('falls back to the code when no name is available', () => {
    const noName: BudgetYear = {
      ...year2022,
      lines: [{ category_code: '99', category_name: null, amount: 1, budget_type: 'planned' }],
    };
    expect(buildCategoryOptions([noName])).toEqual([{ code: '99', name: '99' }]);
  });
});

describe('buildCategorySeries', () => {
  it('uses the resolved type per year and orders years ascending', () => {
    const rows = buildCategorySeries([year2023, year2022], ['133', '44']);
    expect(rows).toEqual([
      { year: 2022, '133': 90, '44': 180 }, // 2022 resolves to executed
      { year: 2023, '133': 110 },           // 2023 resolves to planned; '44' absent → gap
    ]);
  });
  it('returns rows with only the year when no codes are requested', () => {
    expect(buildCategorySeries([year2022], [])).toEqual([{ year: 2022 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/utils/budget.test.ts`
Expected: FAIL — `resolveBudgetType`, `buildCategoryOptions`, `buildCategorySeries` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `frontend/src/utils/budget.ts` (the file already imports `BudgetYear` from `../services/api`):

```ts
export function resolveBudgetType(
  yearData: BudgetYear | null | undefined,
): 'executed' | 'planned' {
  if (!yearData) return 'planned';
  return yearData.lines.some(l => l.budget_type === 'executed') ? 'executed' : 'planned';
}

export function buildCategoryOptions(
  budgetYears: BudgetYear[],
): { code: string; name: string }[] {
  const names = new Map<string, string>();
  for (const year of budgetYears) {
    for (const line of year.lines) {
      const existing = names.get(line.category_code);
      if (existing === undefined) {
        names.set(line.category_code, line.category_name ?? line.category_code);
      } else if (existing === line.category_code && line.category_name) {
        // upgrade a code-only placeholder once a real name appears
        names.set(line.category_code, line.category_name);
      }
    }
  }
  return [...names.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function buildCategorySeries(
  budgetYears: BudgetYear[],
  codes: string[],
): Array<Record<string, number>> {
  const sortedYears = [...budgetYears].sort((a, b) => a.year - b.year);
  return sortedYears.map(year => {
    const type = resolveBudgetType(year);
    const row: Record<string, number> = { year: year.year };
    for (const code of codes) {
      const line = year.lines.find(l => l.category_code === code && l.budget_type === type);
      if (line) row[code] = line.amount;
    }
    return row;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/utils/budget.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/budget.ts frontend/src/utils/budget.test.ts
git commit -m "feat: add budget type resolution and category series helpers"
```

---

## Task 2: CategoryEvolutionChart component

**Files:**
- Modify: `frontend/src/components/city/plots/BudgetSunburst.tsx:45` (export the palette)
- Create: `frontend/src/components/city/plots/CategoryEvolutionChart.tsx`

- [ ] **Step 1: Export the shared palette**

In `frontend/src/components/city/plots/BudgetSunburst.tsx`, change the palette declaration (currently `const SUNBURST_COLORS = [`) to export it:

```ts
export const SUNBURST_COLORS = [
  '#027A76', // dark teal
  '#3A6C7F', // dark blue
  '#C97828', // darkened amber (readable on cream)
  '#AF4749', // red
  '#2E6B52', // darkened sage green
  '#2A6A80', // darkened sky blue
  '#D4602A', // darkened coral
  '#2E7A60', // darkened mint
];
```

- [ ] **Step 2: Create the chart wrapper**

Create `frontend/src/components/city/plots/CategoryEvolutionChart.tsx`:

```tsx
import React from 'react';
import type { BudgetYear } from '../../../services/api';
import { buildCategorySeries } from '../../../utils/budget';
import { LineAreaChart } from './LineAreaChart';
import { SUNBURST_COLORS } from './BudgetSunburst';

const ACCENT = '#3A6C7F';

interface CategoryEvolutionChartProps {
  budgetYears: BudgetYear[];
  /** Full set of selectable categories (provides display names). */
  categories: { code: string; name: string }[];
  /** Currently highlighted category codes. */
  selected: Set<string>;
}

export const CategoryEvolutionChart: React.FC<CategoryEvolutionChartProps> = ({
  budgetYears,
  categories,
  selected,
}) => {
  const selectedCats = categories.filter(c => selected.has(c.code));

  if (selectedCats.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5 w-full text-center"
        style={{ borderColor: `color-mix(in srgb, ${ACCENT} 30%, transparent)`,
                 backgroundColor: `color-mix(in srgb, ${ACCENT} 15%, transparent)` }}
      >
        <h3 className="text-sm font-bold text-[var(--blue-dark)]">Evolución del gasto por área</h3>
        <p className="mt-2 text-xs text-[var(--blue-dark)]/60">
          Selecciona una o más áreas en el panel para ver su evolución a lo largo de los años.
        </p>
      </div>
    );
  }

  const codes = selectedCats.map(c => c.code);
  const data = buildCategorySeries(budgetYears, codes);
  const series = selectedCats.map((c, i) => ({
    key: c.code,
    label: c.name,
    color: SUNBURST_COLORS[i % SUNBURST_COLORS.length],
    type: 'line' as const,
  }));

  return (
    <LineAreaChart
      data={data}
      xKey="year"
      series={series}
      title="Evolución del gasto por área"
      subtitle="Importe por año · ejecutado (planificado cuando no hay ejecución)"
      variant="darkTint"
      accent={ACCENT}
      helpContent={
        <>
          <p><strong>QUÉ VES</strong>: La evolución del importe presupuestario de las áreas seleccionadas a lo largo de los años disponibles. Cada línea es un área de gasto.</p>
          <p><strong>POR QUÉ IMPORTA</strong>: Ver una categoría en el tiempo revela tendencias —refuerzo o recorte sostenido— que una sola foto anual no muestra.</p>
          <p><strong>METODOLOGÍA</strong>: Para cada año se usa el gasto ejecutado; cuando un año aún no tiene ejecución disponible, se usa el planificado. Las áreas sin dato en un año concreto dejan un hueco en su línea.</p>
        </>
      }
    />
  );
};

export default CategoryEvolutionChart;
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: PASS (no errors). The component is not yet imported anywhere; this only verifies it compiles.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/city/plots/BudgetSunburst.tsx frontend/src/components/city/plots/CategoryEvolutionChart.tsx
git commit -m "feat: add CategoryEvolutionChart wrapper over LineAreaChart"
```

---

## Task 3: CategoryHighlightControl widget

**Files:**
- Create: `frontend/src/components/city/map/modes/transparency/CategoryHighlightControl.tsx`

- [ ] **Step 1: Create the control component**

Create `frontend/src/components/city/map/modes/transparency/CategoryHighlightControl.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { ListChecks, MagnifyingGlass } from '@phosphor-icons/react';

const ACCENT = '#3A6C7F';

interface CategoryHighlightControlProps {
  categories: { code: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export const CategoryHighlightControl: React.FC<CategoryHighlightControlProps> = ({
  categories,
  selected,
  onChange,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      c => c.name.toLowerCase().includes(q) || c.code.includes(q),
    );
  }, [categories, query]);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(next);
  };

  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden w-1/3 flex flex-col"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, boxShadow: `0 4px 12px ${ACCENT}55` }}
        >
          <ListChecks size={16} color="white" weight="bold" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[var(--blue-dark)]">Áreas destacadas</h3>
          <p className="text-[10px] text-[var(--blue)] opacity-70 leading-snug">
            Elige qué áreas resaltar en el gráfico y seguir en el tiempo.
          </p>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <MagnifyingGlass
            size={14}
            weight="bold"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--blue-dark)]/40"
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar área…"
            className="w-full rounded-xl border bg-white/70 pl-8 pr-3 py-1.5 text-xs text-[var(--blue-dark)] placeholder:text-[var(--blue-dark)]/40 focus:outline-none focus:ring-2"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          />
        </div>
      </div>

      <div className="px-2 pb-3 overflow-y-auto" style={{ maxHeight: 220 }}>
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-xs text-[var(--blue-dark)]/40">Sin resultados.</p>
        ) : (
          filtered.map(cat => {
            const isOn = selected.has(cat.code);
            return (
              <button
                key={cat.code}
                onClick={() => toggle(cat.code)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-black/5"
              >
                <span
                  className="w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                  style={{
                    backgroundColor: isOn ? ACCENT : 'transparent',
                    borderColor: isOn ? ACCENT : 'rgba(0,0,0,0.25)',
                  }}
                >
                  {isOn ? '✓' : ''}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs text-[var(--blue-dark)]">{cat.name}</span>
                <span className="text-[10px] text-[var(--blue-dark)]/35 flex-shrink-0">{cat.code}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CategoryHighlightControl;
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: PASS. Component is not yet imported; this only verifies it compiles.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/city/map/modes/transparency/CategoryHighlightControl.tsx
git commit -m "feat: add CategoryHighlightControl search-and-tick widget"
```

---

## Task 4: BudgetSunburst — gate the budget-type toggle, dynamic legend

**Files:**
- Modify: `frontend/src/components/city/plots/BudgetSunburst.tsx`

- [ ] **Step 1: Add the `showBudgetTypeToggle` prop**

In the `BudgetSunburstProps` interface (around line 13), add the prop after `showToggle`:

```ts
  showToggle?: boolean;
  showBudgetTypeToggle?: boolean;
  mobilityHighlight?: Set<string>;
```

Then add it to the component's destructured props (around line 177-179), defaulting to `true`:

```tsx
export const BudgetSunburst: React.FC<BudgetSunburstProps> = ({
  data, year, budgetType, onBudgetTypeChange,
  subtitle, variant = 'overlay', showToggle = true, showBudgetTypeToggle = true, mobilityHighlight,
}) => {
```

- [ ] **Step 2: Gate the planned/executed block**

Wrap the "Planned / executed" toggle block (the `<div>` starting with the comment `{/* Planned / executed */}`, around line 626-638) in a conditional so it only renders when `showBudgetTypeToggle` is true:

```tsx
          {/* Planned / executed */}
          {showBudgetTypeToggle && (
            <div className={`flex items-center gap-1 p-1 rounded-xl flex-shrink-0 ${isPanel ? 'bg-gray-100 border border-gray-200' : 'bg-black/30 backdrop-blur-sm border border-white/10'}`}>
              {(['planned', 'executed'] as const).map(t => (
                <button key={t} onClick={() => onBudgetTypeChange(t)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    budgetType === t
                      ? isPanel ? 'bg-white text-gray-800 shadow-sm' : 'bg-white/20 text-white shadow-sm'
                      : isPanel ? 'text-gray-400 hover:text-gray-600' : 'text-white/50 hover:text-white/80'
                  }`}>
                  {t === 'planned' ? 'PLANIFICADO' : 'EJECUTADO'}
                </button>
              ))}
            </div>
          )}
```

- [ ] **Step 3: Make the highlight legend render from the dynamic set**

Replace the mobility legend block (the `{mobilityHighlight && ( ... )}` block near the end, around line 743-759) so it iterates the selected codes, resolving each name from the budget tree and showing an icon only for known mobility codes:

```tsx
        {/* ── Highlight legend ── */}
        {mobilityHighlight && mobilityHighlight.size > 0 && (
          <div className="absolute bottom-8 right-6 flex flex-col items-end gap-0.5">
            {[...mobilityHighlight].map(code => {
              const IconComp = MOBILITY_ICONS[code];
              const label = MOBILITY_LEGEND[code] ?? findNode(data, code)?.name ?? code;
              return (
                <div
                  key={code}
                  className="flex items-center gap-1 cursor-default"
                  onMouseEnter={() => handleLegendEnter(code)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85 }}>
                    {label}
                  </span>
                  {IconComp && <IconComp size={9} weight="bold" color="#059669" />}
                </div>
              );
            })}
          </div>
        )}
```

- [ ] **Step 4: Typecheck and run existing tests**

Run: `cd frontend && npx tsc -b && npx vitest run src/utils/budget.test.ts`
Expected: PASS. `GeneralContext` (default `showBudgetTypeToggle=true`, static `MOBILITY_CODES`) renders exactly as before.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/city/plots/BudgetSunburst.tsx
git commit -m "feat: BudgetSunburst supports hiding budget-type toggle and dynamic highlight legend"
```

---

## Task 5: Wire the selection through the prop contract and render the new UI

> This is a single coordinated change: the `transparencyData` prop contract changes, so every producer and consumer must change together to keep the build green. Make all edits, then typecheck once, then commit.

**Files:**
- Modify: `frontend/src/components/city/MapSheetContent.tsx`
- Modify: `frontend/src/components/city/ModeStatsRouter.tsx`
- Modify: `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx`
- Modify: `frontend/src/components/city/MapDesktop.tsx`
- Modify: `frontend/src/components/city/MapMobile.tsx`

- [ ] **Step 1: Update `TransparencyDataProps`**

In `frontend/src/components/city/MapSheetContent.tsx`, replace the two budget-type fields with the highlight fields:

```ts
export interface TransparencyDataProps {
  budgetYears: BudgetYear[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  highlightCodes: Set<string>;
  onHighlightChange: (next: Set<string>) => void;
  mayors: MayorTerm[];
  elections: ElectionResult[];
  councilors?: CouncilorRecord[];
}
```

- [ ] **Step 2: Update `TransparencyStats` props and body**

In `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx`:

(a) Add imports near the existing plot imports:

```tsx
import { CategoryHighlightControl } from './CategoryHighlightControl';
import CategoryEvolutionChart from '../../../plots/CategoryEvolutionChart';
import { buildCategoryOptions } from '../../../../../utils/budget';
```

(b) In `TransparencyStatsProps`, replace:

```ts
  budgetType: 'planned' | 'executed';
  onBudgetTypeChange: (t: 'planned' | 'executed') => void;
```

with:

```ts
  highlightCodes: Set<string>;
  onHighlightChange: (next: Set<string>) => void;
```

(c) Update the destructured params: replace `budgetType,` and `onBudgetTypeChange,` with `highlightCodes,` and `onHighlightChange,`.

(d) Add the category options memo near the existing `yearData` memo:

```tsx
  const categoryOptions = useMemo(
    () => buildCategoryOptions(budgetYears),
    [budgetYears],
  );
```

(e) Replace the entire "Budget type card" `<div className="rounded-2xl border bg-white/80 ... w-1/3">…</div>` (the block rendered next to the year timeline, currently lines ~102-138) with the control container:

```tsx
            <CategoryHighlightControl
              categories={categoryOptions}
              selected={highlightCodes}
              onChange={onHighlightChange}
            />
```

(f) Immediately after the `BudgetDeltaChart` block (after its closing `)}`, around line 189), add the evolution chart:

```tsx
          {/* ── Category expense evolution ───────────────────────────────── */}
          <CategoryEvolutionChart
            budgetYears={budgetYears}
            categories={categoryOptions}
            selected={highlightCodes}
          />
```

- [ ] **Step 3: Update `ModeStatsRouter` (both paths)**

In `frontend/src/components/city/ModeStatsRouter.tsx`:

(a) Add an import at the top:

```tsx
import { MOBILITY_CODES } from './plots/BudgetSunburst';
```

(b) In `TransparencyContainer`, replace the budget-type state line:

```tsx
  const [budgetType, setBudgetType] = useState<'planned' | 'executed'>('planned');
```

with:

```tsx
  const [highlightCodes, setHighlightCodes] = useState<Set<string>>(() => new Set(MOBILITY_CODES));
```

(c) In `TransparencyContainer`'s returned `<TransparencyStats>`, replace:

```tsx
      budgetType={budgetType}
      onBudgetTypeChange={setBudgetType}
```

with:

```tsx
      highlightCodes={highlightCodes}
      onHighlightChange={setHighlightCodes}
```

(d) In the `transparencyData` path's `<TransparencyStats>`, replace:

```tsx
            budgetType={transparencyData.budgetType}
            onBudgetTypeChange={transparencyData.onBudgetTypeChange}
```

with:

```tsx
            highlightCodes={transparencyData.highlightCodes}
            onHighlightChange={transparencyData.onHighlightChange}
```

- [ ] **Step 4: Update `MapDesktop`**

In `frontend/src/components/city/MapDesktop.tsx`:

(a) Add the helper import alongside the existing `buildSunburstTree` import (find the line importing from `../../utils/budget` or add one):

```tsx
import { buildSunburstTree } from '../../utils/budget';
import { resolveBudgetType } from '../../utils/budget';
```

(If `buildSunburstTree` is already imported from `'../../utils/budget'`, just add `resolveBudgetType` to that existing import list instead of adding a second line.)

(b) Replace the budget-type state (line 133):

```tsx
    const [budgetType, setBudgetType] = useState<'planned' | 'executed'>('planned');
```

with the highlight state plus a derived budget type:

```tsx
    const [highlightCodes, setHighlightCodes] = useState<Set<string>>(() => new Set(MOBILITY_CODES));
    const budgetType = resolveBudgetType(budgetYears.find(by => by.year === selectedYear));
```

(c) In the sunburst overlay (`<BudgetSunburst …>`, lines ~188-195), replace:

```tsx
                    budgetType={budgetType}
                    onBudgetTypeChange={setBudgetType}
                    showToggle={true}
                    mobilityHighlight={MOBILITY_CODES}
```

with:

```tsx
                    budgetType={budgetType}
                    onBudgetTypeChange={() => {}}
                    showToggle={true}
                    showBudgetTypeToggle={false}
                    mobilityHighlight={highlightCodes}
```

(d) In **both** `<TransparencyStats …>` call sites (around lines 225 and 278), replace:

```tsx
                    budgetType={budgetType}
                    onBudgetTypeChange={setBudgetType}
```

with:

```tsx
                    highlightCodes={highlightCodes}
                    onHighlightChange={setHighlightCodes}
```

- [ ] **Step 5: Update `MapMobile`**

In `frontend/src/components/city/MapMobile.tsx`:

(a) Add `resolveBudgetType` to the import from `'../../utils/budget'` (the file already imports `buildSunburstTree` from there; add `resolveBudgetType` to that import).

(b) Replace the budget-type state (line 74):

```tsx
  const [budgetType, setBudgetType] = useState<'planned' | 'executed'>('planned');
```

with:

```tsx
  const [highlightCodes, setHighlightCodes] = useState<Set<string>>(() => new Set(MOBILITY_CODES));
  const budgetType = resolveBudgetType(budgetYears.find(by => by.year === selectedYear));
```

(c) In the `transparencyData` object (lines ~156-164), replace:

```tsx
    budgetType,
    onBudgetTypeChange: setBudgetType,
```

with:

```tsx
    highlightCodes,
    onHighlightChange: setHighlightCodes,
```

(d) In the sunburst overlay (`<BudgetSunburst …>`, lines ~185-192), replace:

```tsx
              budgetType={budgetType}
              onBudgetTypeChange={setBudgetType}
              showToggle={true}
              mobilityHighlight={MOBILITY_CODES}
```

with:

```tsx
              budgetType={budgetType}
              onBudgetTypeChange={() => {}}
              showToggle={true}
              showBudgetTypeToggle={false}
              mobilityHighlight={highlightCodes}
```

- [ ] **Step 6: Typecheck the whole project**

Run: `cd frontend && npx tsc -b`
Expected: PASS — no type errors. If `tsc` reports an unused `buildSunburstTree`/`MOBILITY_CODES` import anywhere, that import was already present and is still used; do not remove it.

- [ ] **Step 7: Run the test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS — existing tests plus `budget.test.ts` all green.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/city/MapSheetContent.tsx \
        frontend/src/components/city/ModeStatsRouter.tsx \
        frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx \
        frontend/src/components/city/MapDesktop.tsx \
        frontend/src/components/city/MapMobile.tsx
git commit -m "feat: drive sunburst highlight + evolution chart from category selection"
```

---

## Task 6: Manual verification

**Files:** none (run the app)

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev`

- [ ] **Step 2: Verify the transparency mode flow**

Open a city in transparency mode and confirm:
- The "Tipo de presupuesto" card is gone; in its place next to the year timeline is the **Áreas destacadas** control with a search box and a scrollable, ticked list (mobility areas ticked by default).
- The sunburst overlay highlights exactly the ticked areas in green; ticking/unticking a category updates the highlight and the corner legend live. Icons appear only for the default mobility areas.
- The sunburst no longer shows the PLANIFICADO/EJECUTADO toggle (only the category focus buttons remain).
- The **Evolución del gasto por área** line chart appears below the budget delta chart, with one line per ticked area; unticking all areas shows the placeholder message.
- Searching in the control filters the list; the chart and highlights reflect the current ticks.
- Resize to mobile width: the same control + chart appear in the bottom sheet and behave the same.

- [ ] **Step 3: Confirm GeneralContext is unaffected**

Open a city's general context view and confirm the budget sunburst there still shows its PLANIFICADO/EJECUTADO toggle and mobility highlight exactly as before.

---

## Self-Review Notes

- **Spec coverage:** shared selection state (Tasks 4–5), toggle removal + per-year resolution (Tasks 1, 5), control container (Tasks 3, 5), evolution chart (Tasks 2, 5), pure helpers with tests (Task 1), `GeneralContext` left unchanged (verified Task 6 Step 3). All spec sections map to tasks.
- **Type consistency:** helper names (`resolveBudgetType`, `buildCategoryOptions`, `buildCategorySeries`), prop names (`highlightCodes`, `onHighlightChange`, `showBudgetTypeToggle`), and the `{ code, name }` category shape are used identically across all tasks.
- **Note on `onBudgetTypeChange`:** `BudgetSunburst` still requires `onBudgetTypeChange`; with `showBudgetTypeToggle={false}` it is never invoked, so the map overlays pass a no-op `() => {}`. This keeps the sunburst's existing prop contract intact (avoids touching `GeneralContext`).
```
