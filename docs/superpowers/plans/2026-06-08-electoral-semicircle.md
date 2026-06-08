# Electoral Semicircle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an electoral hemiciclo to the Transparencia mode showing city council seat composition — one SVG dot per concejal, colored by party.

**Architecture:** New `ElectoralSemicircle` component with an exported pure layout function (`buildSemicircleLayout`) that computes dot positions from party allocations and dimensions. `TransparencyContainer` in `ModeStatsRouter` gains a third fetch (`fetchMayorsTimeline`) to supply elections data. `TransparencyStats` renders the component when the `'electoral'` submode is present.

**Tech Stack:** React + SVG (no chart library), Vitest for unit tests, existing `getPartyColor` and `ElectionResult` types.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/components/city/plots/ElectoralSemicircle.tsx` | Create | Layout algorithm + SVG render + tooltip + legend |
| `frontend/src/components/city/plots/ElectoralSemicircle.test.ts` | Create | Unit tests for `buildSemicircleLayout` |
| `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx` | Modify | Add `elections` prop + gate + render `ElectoralSemicircle` |
| `frontend/src/components/city/ModeStatsRouter.tsx` | Modify | Add `fetchMayorsTimeline` call + pass `elections` state |

---

## Task 1: Write failing tests for `buildSemicircleLayout`

**Files:**
- Create: `frontend/src/components/city/plots/ElectoralSemicircle.test.ts`

- [ ] **Step 1.1: Create the test file**

```ts
// frontend/src/components/city/plots/ElectoralSemicircle.test.ts
import { describe, it, expect } from 'vitest';
import { buildSemicircleLayout } from './ElectoralSemicircle';
import type { PartyAllocation } from './ElectoralSemicircle';

const ALLOCATIONS: PartyAllocation[] = [
  { party: 'PP',   councilors: 11, votes: 50000 },
  { party: 'PSOE', councilors: 9,  votes: 40000 },
  { party: 'Vox',  councilors: 5,  votes: 20000 },
  { party: 'MM',   councilors: 4,  votes: 18000 },
];

const CX = 150, CY = 90, R_INNER = 60, R_OUTER = 90;

describe('buildSemicircleLayout', () => {
  it('returns one dot per councilor', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    expect(dots).toHaveLength(29); // 11+9+5+4
  });

  it('returns empty array for zero seats', () => {
    const dots = buildSemicircleLayout([], CX, CY, R_INNER, R_OUTER);
    expect(dots).toHaveLength(0);
  });

  it('assigns correct party to each dot (parties are contiguous)', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    const ppDots = dots.filter(d => d.party === 'PP');
    const psoeDots = dots.filter(d => d.party === 'PSOE');
    expect(ppDots).toHaveLength(11);
    expect(psoeDots).toHaveLength(9);
  });

  it('all dots lie within the expected radius band', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    for (const dot of dots) {
      const r = Math.sqrt((dot.x - CX) ** 2 + (dot.y - CY) ** 2);
      expect(r).toBeGreaterThanOrEqual(R_INNER - 1);
      expect(r).toBeLessThanOrEqual(R_OUTER + 1);
    }
  });

  it('all dots have y <= CY (arc stays above the baseline)', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    for (const dot of dots) {
      expect(dot.y).toBeLessThanOrEqual(CY + 0.001);
    }
  });

  it('assigns a color string to every dot', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    for (const dot of dots) {
      expect(dot.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('works with a single party', () => {
    const single: PartyAllocation[] = [{ party: 'PP', councilors: 5, votes: null }];
    const dots = buildSemicircleLayout(single, CX, CY, R_INNER, R_OUTER);
    expect(dots).toHaveLength(5);
    expect(dots.every(d => d.party === 'PP')).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run test to confirm it fails (function not yet exported)**

```bash
cd frontend && npx vitest run --project unit src/components/city/plots/ElectoralSemicircle.test.ts
```

Expected: FAIL — `Cannot find module './ElectoralSemicircle'`

---

## Task 2: Implement `buildSemicircleLayout` and make tests pass

**Files:**
- Create: `frontend/src/components/city/plots/ElectoralSemicircle.tsx`

- [ ] **Step 2.1: Create the file with the pure layout function**

```tsx
// frontend/src/components/city/plots/ElectoralSemicircle.tsx
import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { ElectionResult } from '../../../services/api';
import { getPartyColor } from '../../../constants/parties';

export interface PartyAllocation {
  party: string;
  councilors: number;
  votes: number | null;
}

export interface SeatDot {
  x: number;
  y: number;
  party: string;
  color: string;
}

/**
 * Computes SVG dot positions for a two-row hemiciclo.
 * Algorithm mirrors poli_sci_kit: inner row gets fewer seats, outer more;
 * dots are sorted left-to-right by angle then inner-before-outer so parties
 * fill the arc contiguously.
 */
export function buildSemicircleLayout(
  allocations: PartyAllocation[],
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
): SeatDot[] {
  const totalSeats = allocations.reduce((sum, a) => sum + a.councilors, 0);
  if (totalSeats === 0) return [];

  const base = Math.floor(totalSeats / 2);
  const extra = totalSeats - base * 2; // 0 or 1
  const seatsInner = Math.max(1, base - 1);
  const seatsOuter = totalSeats - seatsInner;

  const arcAngles = (n: number): number[] =>
    n === 1
      ? [Math.PI / 2]
      : Array.from({ length: n }, (_, i) => Math.PI - (i * Math.PI) / (n - 1));

  const positions: { theta: number; row: number; x: number; y: number }[] = [];

  for (const theta of arcAngles(seatsInner)) {
    positions.push({ theta, row: 0, x: cx + rInner * Math.cos(theta), y: cy - rInner * Math.sin(theta) });
  }
  for (const theta of arcAngles(seatsOuter)) {
    positions.push({ theta, row: 1, x: cx + rOuter * Math.cos(theta), y: cy - rOuter * Math.sin(theta) });
  }

  // Sort left-to-right (theta desc = π→0), inner before outer at same angle
  positions.sort((a, b) => b.theta - a.theta || a.row - b.row);

  // Expand party labels in order (biggest party first → fills left side)
  const labels: { party: string; color: string }[] = [];
  for (const alloc of allocations) {
    for (let i = 0; i < alloc.councilors; i++) {
      labels.push({ party: alloc.party, color: getPartyColor(alloc.party) });
    }
  }

  return positions.map((pos, i) => ({
    x: pos.x,
    y: pos.y,
    party: labels[i].party,
    color: labels[i].color,
  }));
}

// ── React component ───────────────────────────────────────────────────────────

interface ElectoralSemicircleProps {
  elections: ElectionResult[];
  title?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  party: string;
  councilors: number;
  votes: number | null;
}

const CARD_CLASS = 'rounded-2xl border bg-white/80 backdrop-blur-sm p-5 transition-all hover:bg-white/90';
const CARD_STYLE = { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' };

export const ElectoralSemicircle: React.FC<ElectoralSemicircleProps> = ({
  elections,
  title = 'Composición del pleno',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, party: '', councilors: 0, votes: null,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      if (entries[0]) setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pick most recent year and filter to parties with seats
  const { year, allocations } = useMemo(() => {
    if (elections.length === 0) return { year: null, allocations: [] };
    const latestYear = Math.max(...elections.map(e => e.year));
    const yearData = elections.filter(e => e.year === latestYear && (e.councilors ?? 0) > 0);
    yearData.sort((a, b) => (b.councilors ?? 0) - (a.councilors ?? 0));
    return {
      year: latestYear,
      allocations: yearData.map(e => ({
        party: e.party,
        councilors: e.councilors ?? 0,
        votes: e.votes,
      })),
    };
  }, [elections]);

  const svgHeight = Math.round(width * 0.52);
  const cx = width / 2;
  const cy = svgHeight;
  const rOuter = width * 0.43;
  const rInner = width * 0.27;

  const dots = useMemo(
    () => (width > 0 ? buildSemicircleLayout(allocations, cx, cy, rInner, rOuter) : []),
    [allocations, width, cx, cy, rInner, rOuter],
  );

  const dotRadius = useMemo(() => {
    if (dots.length === 0 || width === 0) return 6;
    const outerArcLen = Math.PI * rOuter;
    const outerCount = dots.filter(d => {
      const r = Math.sqrt((d.x - cx) ** 2 + (d.y - cy) ** 2);
      return r > (rInner + rOuter) / 2;
    }).length;
    return Math.min(8, Math.max(3, (outerArcLen / (outerCount || 1)) * 0.38));
  }, [dots, width, rInner, rOuter, cx, cy]);

  const totalSeats = allocations.reduce((s, a) => s + a.councilors, 0);

  const handleMouseEnter = (e: React.MouseEvent<SVGCircleElement>, dot: SeatDot, alloc: PartyAllocation) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      party: dot.party,
      councilors: alloc.councilors,
      votes: alloc.votes,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGCircleElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }));
  };

  if (allocations.length === 0) {
    return (
      <div className={CARD_CLASS} style={CARD_STYLE}>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No hay datos electorales disponibles.</p>
      </div>
    );
  }

  // Build lookup for tooltip data by party
  const allocByParty = Object.fromEntries(allocations.map(a => [a.party, a]));

  return (
    <div className={`${CARD_CLASS} flex flex-col`} style={CARD_STYLE}>
      <div className="mb-2">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{title}</h3>
        {year && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">
            {totalSeats} concejales · Elecciones municipales {year}
          </p>
        )}
      </div>

      <div ref={containerRef} className="relative" style={{ height: svgHeight > 0 ? svgHeight : 120 }}>
        {width > 0 && (
          <svg width={width} height={svgHeight} style={{ display: 'block', overflow: 'visible' }}>
            {/* Baseline */}
            <line x1={0} y1={cy} x2={width} y2={cy} stroke="#f3f4f6" strokeWidth={2} />

            {dots.map((dot, i) => (
              <circle
                key={i}
                cx={dot.x}
                cy={dot.y}
                r={dotRadius}
                fill={dot.color}
                fillOpacity={0.88}
                className="transition-all hover:fill-opacity-100"
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => handleMouseEnter(e, dot, allocByParty[dot.party])}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
              />
            ))}
          </svg>
        )}

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[160px]"
            style={{ left: tooltip.x + 12, top: tooltip.y - 12, transform: 'translateY(-50%)' }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getPartyColor(tooltip.party) }} />
              <span className="text-xs font-bold text-gray-800 leading-tight">{tooltip.party}</span>
            </div>
            <div className="h-px bg-black/5 my-0.5" />
            <div className="text-[11px] font-medium text-gray-600">
              {tooltip.councilors} concejal{tooltip.councilors !== 1 ? 'es' : ''}
            </div>
            {tooltip.votes != null && (
              <div className="text-[10px] text-gray-400 font-medium">
                {tooltip.votes.toLocaleString('es-ES')} votos
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
        {allocations.map(alloc => (
          <span key={alloc.party} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
            <span
              className="inline-block rounded-full flex-shrink-0"
              style={{ width: 8, height: 8, backgroundColor: getPartyColor(alloc.party) }}
            />
            {alloc.party} · {alloc.councilors}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ElectoralSemicircle;
```

- [ ] **Step 2.2: Run tests — expect them to pass**

```bash
cd frontend && npx vitest run --project unit src/components/city/plots/ElectoralSemicircle.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 2.3: Commit**

```bash
git add frontend/src/components/city/plots/ElectoralSemicircle.tsx \
        frontend/src/components/city/plots/ElectoralSemicircle.test.ts
git commit -m "feat(transparency): add ElectoralSemicircle component with layout algorithm"
```

---

## Task 3: Wire `ElectoralSemicircle` into `TransparencyStats`

**Files:**
- Modify: `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx`

- [ ] **Step 3.1: Add `elections` prop and render `ElectoralSemicircle`**

Open `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx`.

Add the import at the top (after the existing imports):
```ts
import { ElectoralSemicircle } from '../../../plots/ElectoralSemicircle';
import type { ElectionResult } from '../../../../../services/api';
```

Extend the `TransparencyStatsProps` interface — add one field:
```ts
elections: ElectionResult[];
```

The full updated interface:
```ts
interface TransparencyStatsProps {
  city: CityData;
  budgetYears: BudgetYear[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  budgetType: 'planned' | 'executed';
  onBudgetTypeChange: (t: 'planned' | 'executed') => void;
  mayors: MayorTerm[];
  elections: ElectionResult[];
}
```

Update the destructuring in the function signature to include `elections`:
```ts
export default function TransparencyStats({
  city,
  budgetYears,
  selectedYear,
  onYearChange,
  budgetType,
  onBudgetTypeChange,
  mayors,
  elections,
}: TransparencyStatsProps) {
```

Add the gate flag alongside the existing `hasBudget` and `hasMayors` lines:
```ts
const hasElections = submodes.includes('electoral') && elections.length > 0;
```

Append the `ElectoralSemicircle` render at the end of the returned `<div>`, after the mayors block:
```tsx
{/* ── Electoral semicircle ─────────────────────────────────────────────── */}
{hasElections && (
  <ElectoralSemicircle elections={elections} />
)}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3.3: Commit**

```bash
git add frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx
git commit -m "feat(transparency): wire ElectoralSemicircle into TransparencyStats"
```

---

## Task 4: Fetch elections data in `TransparencyContainer`

**Files:**
- Modify: `frontend/src/components/city/ModeStatsRouter.tsx`

- [ ] **Step 4.1: Add `fetchMayorsTimeline` import and `elections` state**

Open `frontend/src/components/city/ModeStatsRouter.tsx`.

Update the api import line (add `fetchMayorsTimeline` and `ElectionResult`):
```ts
import { fetchCityBudgets, fetchCityContext, fetchMayorsTimeline } from '../../services/api';
import type { BudgetYear, MayorTerm, ElectionResult } from '../../services/api';
```

Inside `TransparencyContainer`, add the elections state alongside existing state:
```ts
const [elections, setElections] = useState<ElectionResult[]>([]);
```

Update the `Promise.all` inside `useEffect` to also call `fetchMayorsTimeline`:
```ts
Promise.all([
  fetchCityBudgets(city.id).catch(() => [] as BudgetYear[]),
  fetchCityContext(city.id).catch(() => ({ mayors: [] as MayorTerm[], budget_year: null, budget_categories: {} })),
  fetchMayorsTimeline(city.id).catch(() => ({ mayors: [], elections: [] as ElectionResult[] })),
]).then(([budgets, context, timeline]) => {
  setBudgetYears(budgets);
  if (budgets.length > 0) setSelectedYear(budgets[0].year);
  setMayors(context.mayors ?? []);
  setElections(timeline.elections ?? []);
});
```

Pass `elections` to `TransparencyStats`:
```tsx
return (
  <TransparencyStats
    city={city}
    budgetYears={budgetYears}
    selectedYear={selectedYear}
    onYearChange={setSelectedYear}
    budgetType={budgetType}
    onBudgetTypeChange={setBudgetType}
    mayors={mayors}
    elections={elections}
  />
);
```

- [ ] **Step 4.2: Update the `transparencyData` pass-through path**

The `ModeStatsRouter` also renders `TransparencyStats` directly when `transparencyData` is provided (the desktop path). The `TransparencyDataProps` interface in `MapSheetContent.tsx` and the `TransparencyStats` call inside `ModeStatsRouter` both need `elections`.

Open `frontend/src/components/city/MapSheetContent.tsx`. Add `elections` to `TransparencyDataProps`:
```ts
export interface TransparencyDataProps {
  budgetYears: BudgetYear[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  budgetType: 'planned' | 'executed';
  onBudgetTypeChange: (t: 'planned' | 'executed') => void;
  mayors: MayorTerm[];
  elections: ElectionResult[];
}
```

Also add the import for `ElectionResult` in `MapSheetContent.tsx`:
```ts
import type { BudgetYear, MayorTerm, ElectionResult } from '../../services/api';
```

Back in `ModeStatsRouter.tsx`, update the `transparencyData` pass-through block to include `elections`:
```tsx
case MAP_MODES.TRANSPARENCY:
  if (transparencyData && transparencyData.budgetYears.length > 0) {
    return (
      <TransparencyStats
        city={city}
        budgetYears={transparencyData.budgetYears}
        selectedYear={transparencyData.selectedYear}
        onYearChange={transparencyData.onYearChange}
        budgetType={transparencyData.budgetType}
        onBudgetTypeChange={transparencyData.onBudgetTypeChange}
        mayors={transparencyData.mayors}
        elections={transparencyData.elections}
      />
    );
  }
  return <TransparencyContainer city={city} />;
```

- [ ] **Step 4.3: Update `MapMobile.tsx` — the one other caller of `TransparencyDataProps`**

`MapMobile.tsx` constructs `transparencyData` with its own fetch loop. It needs elections data too.

Open `frontend/src/components/city/MapMobile.tsx`.

Add `fetchMayorsTimeline` and `ElectionResult` to the import line:
```ts
import { fetchCityBudgets, fetchCityContext, fetchMayorsTimeline } from '../../services/api';
import type { BudgetYear, MayorTerm, ElectionResult } from '../../services/api';
```

Add elections state alongside the existing state declarations (around line 63):
```ts
const [elections, setElections] = useState<ElectionResult[]>([]);
```

Update the existing `Promise.all` inside `useEffect` (around line 65) to add the third fetch:
```ts
Promise.all([
  fetchCityBudgets(city.id).catch(() => [] as BudgetYear[]),
  fetchCityContext(city.id).catch(() => ({ mayors: [] as MayorTerm[], budget_year: null, budget_categories: {} })),
  fetchMayorsTimeline(city.id).catch(() => ({ mayors: [], elections: [] as ElectionResult[] })),
]).then(([budgets, context, timeline]) => {
  setBudgetYears(budgets);
  if (budgets.length > 0) setSelectedYear(budgets[0].year);
  setMayors(context.mayors ?? []);
  setElections(timeline.elections ?? []);
});
```

Add `elections` to the `transparencyData` object (around line 138):
```ts
const transparencyData = {
  budgetYears,
  selectedYear,
  onYearChange: setSelectedYear,
  budgetType,
  onBudgetTypeChange: setBudgetType,
  mayors,
  elections,
};
```

- [ ] **Step 4.4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4.5: Commit**

```bash
git add frontend/src/components/city/ModeStatsRouter.tsx \
        frontend/src/components/city/MapSheetContent.tsx
git commit -m "feat(transparency): fetch and pass elections data to ElectoralSemicircle"
```

---

## Task 5: Manual smoke test

- [ ] **Step 5.1: Start the dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 5.2: Navigate to a city with electoral data**

Open the app, select a city (Madrid, Barcelona, or another Spanish city with `electoral` in its transparency submodes), switch to Transparencia mode.

Expected:
- The hemiciclo card appears below the Mayors Gantt chart
- Dots are colored by party
- Hovering a dot shows the tooltip with party name, seat count, and vote count
- The legend below lists all parties with seat counts
- No console errors

- [ ] **Step 5.3: Check a city without electoral data**

Select a city without the `'electoral'` submode. 

Expected: The hemiciclo card does not appear at all.

- [ ] **Step 5.4: Run the full unit test suite**

```bash
cd frontend && npx vitest run --project unit
```

Expected: All tests pass, including the 7 new `ElectoralSemicircle` tests.

- [ ] **Step 5.5: Final commit (if any fixes were needed in smoke test)**

```bash
git add -p  # stage only the relevant fixes
git commit -m "fix(transparency): address smoke test issues in ElectoralSemicircle"
```
