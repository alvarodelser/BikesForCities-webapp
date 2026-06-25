# Transparency Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Transparencia` map mode to CityPage that shows the city's building layer as a locked decorative backdrop with a budget sunburst overlay, plus a stats section with a year selector, budget metric cards, a vertical delta chart (executed − planned per category), and the mayor timeline.

**Architecture:** The mode integrates into the existing hero → mode pills → map slot → stats layout without special-casing. `CityMap` gains a `locked` prop that suppresses controls/legend/interaction via CSS. Budget data and mayor context are fetched in parallel with the existing infra stats fetch in `MapDesktop`. A new `TransparencyStats` component is rendered directly from `MapDesktop` (bypassing `ModeStatsRouter`) when the mode is active. A pure `buildSunburstTree` helper converts flat `BudgetYear` lines into the tree structure `BudgetSunburst` expects.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, d3-scale (already a dependency), `@phosphor-icons/react` (Scales icon), Vitest + jsdom for unit tests. Run tests with `npx vitest run --project unit` from `frontend/`.

---

### Task 1: Add TRANSPARENCY to MAP_MODES

**Files:**
- Modify: `frontend/src/constants/mapModes.ts`

- [ ] **Step 1: Add the constant**

Replace the file content with:

```ts
export const MAP_MODES = {
  INFRASTRUCTURE: 'infrastructure',
  TRAFFIC: 'traffic',
  STATIONS: 'stations',
  ACCIDENTS: 'accidents',
  TRANSPARENCY: 'transparency',
} as const;

export type MapMode = typeof MAP_MODES[keyof typeof MAP_MODES];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (new constant is additive).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/constants/mapModes.ts
git commit -m "feat(transparency): add TRANSPARENCY to MAP_MODES"
```

---

### Task 2: Add `buildSunburstTree` utility

**Files:**
- Create: `frontend/src/utils/budget.ts`
- Create: `frontend/src/utils/budget.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSunburstTree } from './budget';
import type { BudgetYear } from '../services/api';

const sampleYear: BudgetYear = {
  year: 2023,
  total_income: 500_000,
  total_expenses: 480_000,
  public_debt: 120_000,
  lines: [
    { category_code: '1',   category_name: 'Personal',     amount: 200_000, budget_type: 'planned' },
    { category_code: '1a',  category_name: 'Fijo',         amount: 150_000, budget_type: 'planned' },
    { category_code: '1b',  category_name: 'Temporal',     amount: 50_000,  budget_type: 'planned' },
    { category_code: '2',   category_name: 'Inversiones',  amount: 80_000,  budget_type: 'planned' },
    { category_code: '1',   category_name: 'Personal',     amount: 210_000, budget_type: 'executed' },
    { category_code: '1a',  category_name: 'Fijo',         amount: 160_000, budget_type: 'executed' },
    { category_code: '1b',  category_name: 'Temporal',     amount: 50_000,  budget_type: 'executed' },
    { category_code: '2',   category_name: 'Inversiones',  amount: 70_000,  budget_type: 'executed' },
  ],
};

describe('buildSunburstTree', () => {
  it('returns root node with children', () => {
    const tree = buildSunburstTree([sampleYear], 2023, 'planned');
    expect(tree.code).toBe('root');
    expect(tree.children).toHaveLength(2);
  });

  it('filters by budget type', () => {
    const planned = buildSunburstTree([sampleYear], 2023, 'planned');
    const executed = buildSunburstTree([sampleYear], 2023, 'executed');
    // Children should exist in both cases
    expect(planned.children).toHaveLength(2);
    expect(executed.children).toHaveLength(2);
  });

  it('nests children under top-level codes', () => {
    const tree = buildSunburstTree([sampleYear], 2023, 'planned');
    const personal = tree.children!.find(c => c.code === '1');
    expect(personal).toBeDefined();
    expect(personal!.children).toHaveLength(2);
    expect(personal!.children!.map(c => c.code)).toContain('1a');
    expect(personal!.children!.map(c => c.code)).toContain('1b');
  });

  it('returns empty tree for missing year', () => {
    const tree = buildSunburstTree([sampleYear], 9999, 'planned');
    expect(tree.children).toHaveLength(0);
  });

  it('leaf nodes carry their amount', () => {
    const tree = buildSunburstTree([sampleYear], 2023, 'planned');
    const personal = tree.children!.find(c => c.code === '1')!;
    const fijo = personal.children!.find(c => c.code === '1a')!;
    expect(fijo.amount).toBe(150_000);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && npx vitest run --project unit src/utils/budget.test.ts 2>&1 | tail -20
```

Expected: error like `Cannot find module './budget'`.

- [ ] **Step 3: Implement `buildSunburstTree`**

Create `frontend/src/utils/budget.ts`:

```ts
import type { BudgetYear } from '../services/api';
import type { BudgetNode } from '../components/city/plots/BudgetSunburst';

export function buildSunburstTree(
  budgetYears: BudgetYear[],
  selectedYear: number,
  budgetType: 'planned' | 'executed',
): BudgetNode {
  const yearData = budgetYears.find(y => y.year === selectedYear);
  if (!yearData || yearData.lines.length === 0) {
    return { code: 'root', name: 'Presupuesto', amount: 0, children: [] };
  }

  const lines = yearData.lines.filter(l => l.budget_type === budgetType);
  if (lines.length === 0) {
    return { code: 'root', name: 'Presupuesto', amount: 0, children: [] };
  }

  // Determine top-level code length (shortest code in the data)
  const minLen = Math.min(...lines.map(l => l.category_code.length));
  const topLines = lines.filter(l => l.category_code.length === minLen);
  const subLines = lines.filter(l => l.category_code.length > minLen);

  const children: BudgetNode[] = topLines.map(topLine => {
    const topCode = topLine.category_code;
    const subs = subLines.filter(l => l.category_code.startsWith(topCode));

    if (subs.length === 0) {
      return { code: topCode, name: topLine.category_name ?? topCode, amount: topLine.amount };
    }

    return {
      code: topCode,
      name: topLine.category_name ?? topCode,
      amount: 0, // BudgetSunburst sums from leaf nodes
      children: subs.map(s => ({
        code: s.category_code,
        name: s.category_name ?? s.category_code,
        amount: s.amount,
      })),
    };
  });

  return { code: 'root', name: 'Presupuesto', amount: 0, children };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && npx vitest run --project unit src/utils/budget.test.ts 2>&1 | tail -20
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/budget.ts frontend/src/utils/budget.test.ts
git commit -m "feat(transparency): add buildSunburstTree budget helper"
```

---

### Task 3: Build `BudgetDeltaChart` component

**Files:**
- Create: `frontend/src/components/city/plots/BudgetDeltaChart.tsx`
- Create: `frontend/src/components/city/plots/BudgetDeltaChart.test.ts`

- [ ] **Step 1: Write failing test for the data derivation function**

Create `frontend/src/components/city/plots/BudgetDeltaChart.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDeltaData } from './BudgetDeltaChart';
import type { BudgetYear } from '../../../services/api';

const sampleYear: BudgetYear = {
  year: 2023,
  total_income: 500_000,
  total_expenses: 480_000,
  public_debt: 120_000,
  lines: [
    { category_code: '1', category_name: 'Personal',    amount: 200_000, budget_type: 'planned' },
    { category_code: '2', category_name: 'Inversiones', amount: 80_000,  budget_type: 'planned' },
    { category_code: '1', category_name: 'Personal',    amount: 220_000, budget_type: 'executed' },
    { category_code: '2', category_name: 'Inversiones', amount: 60_000,  budget_type: 'executed' },
  ],
};

describe('buildDeltaData', () => {
  it('computes delta = executed - planned per category', () => {
    const data = buildDeltaData(sampleYear);
    const personal = data.find(d => d.code === '1');
    const inversiones = data.find(d => d.code === '2');
    expect(personal?.delta).toBe(20_000);   // 220k - 200k
    expect(inversiones?.delta).toBe(-20_000); // 60k - 80k
  });

  it('returns empty array when both planned and executed are missing', () => {
    const emptyYear: BudgetYear = { ...sampleYear, lines: [] };
    expect(buildDeltaData(emptyYear)).toHaveLength(0);
  });

  it('includes deltaPct', () => {
    const data = buildDeltaData(sampleYear);
    const personal = data.find(d => d.code === '1')!;
    expect(personal.deltaPct).toBeCloseTo(10); // 20k / 200k = 10%
  });

  it('sorts by absolute delta descending', () => {
    const data = buildDeltaData(sampleYear);
    expect(Math.abs(data[0].delta)).toBeGreaterThanOrEqual(Math.abs(data[1].delta));
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && npx vitest run --project unit src/components/city/plots/BudgetDeltaChart.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module './BudgetDeltaChart'` or `buildDeltaData is not a function`.

- [ ] **Step 3: Implement `BudgetDeltaChart`**

Create `frontend/src/components/city/plots/BudgetDeltaChart.tsx`:

```tsx
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import type { BudgetYear } from '../../../services/api';

export interface DeltaDatum {
  code: string;
  name: string;
  planned: number;
  executed: number;
  delta: number;
  deltaPct: number;
}

export function buildDeltaData(budgetYear: BudgetYear): DeltaDatum[] {
  const { lines } = budgetYear;
  if (lines.length === 0) return [];

  const minLen = Math.min(...lines.map(l => l.category_code.length));
  const topLines = lines.filter(l => l.category_code.length === minLen);

  const planned = new Map<string, { name: string; amount: number }>();
  const executed = new Map<string, { name: string; amount: number }>();

  for (const line of topLines) {
    const map = line.budget_type === 'planned' ? planned : line.budget_type === 'executed' ? executed : null;
    if (!map) continue;
    const existing = map.get(line.category_code);
    map.set(line.category_code, {
      name: line.category_name ?? line.category_code,
      amount: (existing?.amount ?? 0) + line.amount,
    });
  }

  const codes = new Set([...planned.keys(), ...executed.keys()]);
  return Array.from(codes)
    .map(code => {
      const p = planned.get(code)?.amount ?? 0;
      const e = executed.get(code)?.amount ?? 0;
      const delta = e - p;
      const deltaPct = p !== 0 ? (delta / p) * 100 : 0;
      const name = planned.get(code)?.name ?? executed.get(code)?.name ?? code;
      return { code, name, planned: p, executed: e, delta, deltaPct };
    })
    .filter(d => d.planned > 0 || d.executed > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function formatDelta(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '+';
  if (abs >= 1_000_000_000) return `${sign}€${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)}K`;
  return `${sign}€${abs.toFixed(0)}`;
}

function formatEur(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) return `€${(amount / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(amount) >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `€${(amount / 1_000).toFixed(0)}K`;
  return `€${amount.toFixed(0)}`;
}

// ── Chart constants ────────────────────────────────────────────────────────────

const MARGIN = { top: 24, right: 16, bottom: 80, left: 64 };
const CHART_HEIGHT = 300;

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  datum: DeltaDatum | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BudgetDeltaChartProps {
  budgetYear: BudgetYear;
  title?: string;
  subtitle?: string;
}

export const BudgetDeltaChart: React.FC<BudgetDeltaChartProps> = ({
  budgetYear,
  title = 'Ejecución presupuestaria',
  subtitle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, datum: null });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      if (entries[0]) setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => buildDeltaData(budgetYear), [budgetYear]);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(
    () => scaleBand<string>().domain(data.map(d => d.code)).range([0, innerWidth]).padding(0.3),
    [data, innerWidth],
  );

  const yMax = useMemo(
    () => (data.length > 0 ? Math.max(...data.map(d => Math.abs(d.delta))) * 1.15 : 1),
    [data],
  );

  const yScale = useMemo(
    () => scaleLinear().domain([-yMax, yMax]).range([innerHeight, 0]).nice(),
    [yMax, innerHeight],
  );

  const cardClass = 'rounded-2xl border bg-white/80 backdrop-blur-sm p-5 transition-all hover:bg-white/90';
  const cardStyle = { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' };

  if (data.length === 0) {
    return (
      <div className={cardClass} style={cardStyle}>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No hay datos comparables para este año.</p>
      </div>
    );
  }

  const zeroY = yScale(0);

  // Y-axis ticks
  const yTicks = yScale.ticks(5);

  const handleMouseEnter = (e: React.MouseEvent<SVGRectElement>, datum: DeltaDatum) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ visible: true, x: e.clientX - rect.left, y: e.clientY - rect.top, datum });
  };
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }));
  };
  const handleMouseLeave = () => setTooltip(prev => ({ ...prev, visible: false }));

  return (
    <div className={`${cardClass} flex flex-col`} style={cardStyle}>
      <div className="mb-4">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{title}</h3>
        {subtitle && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">{subtitle}</p>
        )}
      </div>

      <div ref={containerRef} className="relative" style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={CHART_HEIGHT} style={{ display: 'block', overflow: 'visible' }}>
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

              {/* Y grid lines + labels */}
              {yTicks.map((tick, i) => (
                <g key={i} transform={`translate(0, ${yScale(tick)})`}>
                  <line x1={0} x2={innerWidth} stroke="#f3f4f6" strokeWidth={1} />
                  <text
                    x={-8}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={9}
                    fontWeight={600}
                    fill="#9ca3af"
                  >
                    {formatDelta(tick)}
                  </text>
                </g>
              ))}

              {/* Bars */}
              {data.map(d => {
                const x = xScale(d.code) ?? 0;
                const bw = xScale.bandwidth();
                const isPositive = d.delta >= 0;
                const barY = isPositive ? yScale(d.delta) : zeroY;
                const barH = Math.abs(yScale(d.delta) - zeroY);
                const color = isPositive ? 'var(--red, #e74c3c)' : '#3A6C7F';

                return (
                  <rect
                    key={d.code}
                    x={x}
                    y={barY}
                    width={bw}
                    height={Math.max(barH, 1)}
                    fill={color}
                    fillOpacity={0.85}
                    rx={3}
                    onMouseEnter={e => handleMouseEnter(e, d)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    className="transition-opacity hover:opacity-100"
                    style={{ cursor: 'pointer', opacity: 0.85 }}
                  />
                );
              })}

              {/* Zero baseline */}
              <line
                x1={0}
                x2={innerWidth}
                y1={zeroY}
                y2={zeroY}
                stroke="#374151"
                strokeWidth={1.5}
              />

              {/* X-axis labels */}
              {data.map(d => {
                const x = (xScale(d.code) ?? 0) + xScale.bandwidth() / 2;
                const label = d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name;
                return (
                  <text
                    key={d.code}
                    x={x}
                    y={innerHeight + 12}
                    textAnchor="end"
                    fontSize={9}
                    fontWeight={600}
                    fill="#6b7280"
                    transform={`rotate(-40, ${x}, ${innerHeight + 12})`}
                    style={{ userSelect: 'none' }}
                  >
                    {label}
                  </text>
                );
              })}
            </g>
          </svg>
        )}

        {/* Tooltip */}
        {tooltip.visible && tooltip.datum && (
          <div
            className="fixed z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[200px]"
            style={{ left: tooltip.x + 15, top: tooltip.y - 15, transform: 'translateY(-50%)' }}
          >
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
              Ejecución
            </div>
            <div className="text-xs font-bold text-gray-800 leading-tight">
              {tooltip.datum.name}
            </div>
            <div className="h-px bg-black/5 my-1" />
            <div className="flex justify-between text-[11px] font-medium text-gray-600">
              <span>Planificado</span><span>{formatEur(tooltip.datum.planned)}</span>
            </div>
            <div className="flex justify-between text-[11px] font-medium text-gray-600">
              <span>Ejecutado</span><span>{formatEur(tooltip.datum.executed)}</span>
            </div>
            <div className="flex justify-between text-[11px] font-bold mt-0.5"
              style={{ color: tooltip.datum.delta >= 0 ? 'var(--red, #e74c3c)' : '#3A6C7F' }}>
              <span>Desviación</span>
              <span>{formatDelta(tooltip.datum.delta)} ({tooltip.datum.deltaPct.toFixed(1)}%)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetDeltaChart;
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run --project unit src/components/city/plots/BudgetDeltaChart.test.ts 2>&1 | tail -10
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/city/plots/BudgetDeltaChart.tsx frontend/src/components/city/plots/BudgetDeltaChart.test.ts
git commit -m "feat(transparency): add BudgetDeltaChart vertical delta component"
```

---

### Task 4: Extend `CityMap` with `locked` prop

**Files:**
- Modify: `frontend/src/components/city/CityMap.tsx`

- [ ] **Step 1: Add `locked` to the props interface and destructuring**

In `frontend/src/components/city/CityMap.tsx`, change the interface at line 17 and the component signature at line 55:

```tsx
// Before — interface (lines 17-23):
interface CityMapProps {
    city: CityData;
    selectedColor?: string;
    bottomOffset?: number;
    onEdgeSelect?: (id: number | null) => void;
}

// After:
interface CityMapProps {
    city: CityData;
    selectedColor?: string;
    bottomOffset?: number;
    onEdgeSelect?: (id: number | null) => void;
    locked?: boolean;
}
```

```tsx
// Before — component signature (line 55):
const CityMap: React.FC<CityMapProps> = ({ city, selectedColor = 'var(--blue)', bottomOffset = 0, onEdgeSelect }) => {

// After:
const CityMap: React.FC<CityMapProps> = ({ city, selectedColor = 'var(--blue)', bottomOffset = 0, onEdgeSelect, locked = false }) => {
```

- [ ] **Step 2: Suppress header + desktop MapControls when locked**

Change the desktop header block (currently `{!isMobile && (`) to:

```tsx
{!isMobile && !locked && (
    <div className="z-20 pb-4 shrink-0">
        {/* ... existing content unchanged ... */}
    </div>
)}
```

- [ ] **Step 3: Suppress mobile MapControls when locked**

Change the mobile controls block (currently `{isMobile && (`) to:

```tsx
{isMobile && !locked && (
    <div
        className="absolute right-4 z-20 transition-all duration-300"
        style={{ bottom: `${bottomOffset + 12}px` }}
    >
        <MapControls
            colorScheme={colorScheme}
            vertical
            onHelpClick={() => helpOpen ? closeMapHelp() : openMapHelp()}
        />
    </div>
)}
```

- [ ] **Step 4: Disable pointer events on map canvas when locked**

Change the map canvas wrapper div (currently `<div className={`z-10 ...`}>`) to:

```tsx
<div
    className={`z-10 ${isMobile ? 'absolute inset-0' : 'relative flex-1 min-h-0 pb-4'}`}
    style={locked ? { pointerEvents: 'none' } : undefined}
>
```

- [ ] **Step 5: Suppress CityLegend when locked**

Change line 213 from:

```tsx
<CityLegend colorScheme={colorScheme} bottomOffset={bottomOffset} defaultOpen={!isMobile} />
```

to:

```tsx
{!locked && <CityLegend colorScheme={colorScheme} bottomOffset={bottomOffset} defaultOpen={!isMobile} />}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/city/CityMap.tsx
git commit -m "feat(transparency): add locked prop to CityMap"
```

---

### Task 5: Register mode in `MapFilters`

**Files:**
- Modify: `frontend/src/components/city/MapFilters.tsx`

- [ ] **Step 1: Add Scales to the phosphor import**

Change the import at the top of the file from:

```tsx
import { RoadHorizon, Graph, Bicycle, Warning } from '@phosphor-icons/react';
```

to:

```tsx
import { RoadHorizon, Graph, Bicycle, Warning, Scales } from '@phosphor-icons/react';
```

- [ ] **Step 2: Add Transparencia to MODE_META**

`MODE_META` is a const array. Add the new entry at the end:

```tsx
const MODE_META = [
  { id: MAP_MODES.INFRASTRUCTURE, name: 'Infraestructura',     color: '#027A76',      icon: RoadHorizon },
  { id: MAP_MODES.TRAFFIC,        name: 'Modelo de Movilidad', color: '#3A6C7F',      icon: Graph       },
  { id: MAP_MODES.STATIONS,       name: 'Servicio Bici',       color: '#ffa585',      icon: Bicycle     },
  { id: MAP_MODES.ACCIDENTS,      name: 'Accidentes',          color: 'var(--red)',   icon: Warning     },
  { id: MAP_MODES.TRANSPARENCY,   name: 'Transparencia',       color: '#3A6C7F',      icon: Scales      },
] as const;
```

- [ ] **Step 3: Add context copy**

Add an entry to `CONTEXT_COPY`:

```tsx
[MAP_MODES.TRANSPARENCY]: {
  title: 'Presupuesto y gobierno municipal',
  body: 'Explora cómo el ayuntamiento gestiona sus recursos. Compara lo presupuestado con lo ejecutado por área de gasto, y consulta el historial de mandatos municipales. Los datos provienen de los presupuestos municipales publicados.',
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/city/MapFilters.tsx
git commit -m "feat(transparency): register Transparencia pill in MapFilters"
```

---

### Task 6: Build `TransparencyStats` component

**Files:**
- Create: `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx`

- [ ] **Step 1: Create the directory and component**

Create `frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx`:

```tsx
import React, { useMemo } from 'react';
import type { CityData } from '../../../../../constants/cities';
import type { BudgetYear, MayorTerm } from '../../../../../services/api';
import PeriodRangeTimeline from '../PeriodRangeTimeline';
import BudgetDeltaChart from '../../../../plots/BudgetDeltaChart';
import { MayorsGanttChart } from '../../../../plots/MayorsGanttChart';
import GlassCard from '../../../../ui/GlassCard';
import { formatCurrency } from '../../../../../utils/formatters';
import { TrendingUp, Euro, Landmark } from 'lucide-react';

interface TransparencyStatsProps {
  city: CityData;
  budgetYears: BudgetYear[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  mayors: MayorTerm[];
}

const TransparencyStats: React.FC<TransparencyStatsProps> = ({
  budgetYears,
  selectedYear,
  onYearChange,
  mayors,
}) => {
  const yearData = useMemo(
    () => budgetYears.find(y => y.year === selectedYear) ?? null,
    [budgetYears, selectedYear],
  );

  const yearItems = useMemo(
    () => [...budgetYears].sort((a, b) => a.year - b.year).map(y => String(y.year)),
    [budgetYears],
  );

  const metricCards = [
    { label: 'Ingresos totales', value: yearData?.total_income ?? null,   icon: TrendingUp },
    { label: 'Gastos totales',   value: yearData?.total_expenses ?? null, icon: Euro       },
    { label: 'Deuda pública',    value: yearData?.public_debt ?? null,    icon: Landmark   },
  ];

  return (
    <div className="space-y-8">

      {/* Year selector */}
      {yearItems.length > 1 && (
        <PeriodRangeTimeline
          items={yearItems}
          from={String(selectedYear)}
          to={String(selectedYear)}
          onChange={(from) => onYearChange(Number(from))}
          accent="#3A6C7F"
          unit="año"
        />
      )}

      {/* Summary metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <GlassCard
            key={label}
            surface="glass"
            tint="rgba(255,255,255,0.85)"
            className="p-4 flex items-center gap-3 border border-black/5"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e2d5a] to-[#3A6C7F] flex items-center justify-center shadow-md flex-shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--blue)] font-bold opacity-70">
                {label}
              </p>
              <p className="text-lg font-bold text-[var(--blue-dark)] leading-tight">
                {value != null ? formatCurrency(value) : '—'}
              </p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Delta chart */}
      {yearData && (
        <BudgetDeltaChart
          budgetYear={yearData}
          title="Ejecución presupuestaria"
          subtitle={`Ejecutado − Planificado · ${selectedYear}`}
        />
      )}

      {/* Mayor timeline */}
      {mayors.length > 0 && (
        <MayorsGanttChart
          terms={mayors}
          title="Historial de Alcaldía"
        />
      )}

    </div>
  );
};

export default TransparencyStats;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If you see an import error for `PeriodRangeTimeline`, check the path — it lives at `frontend/src/components/city/map/modes/PeriodRangeTimeline.tsx`, so the import from `transparency/TransparencyStats.tsx` is `../PeriodRangeTimeline`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/city/map/modes/transparency/TransparencyStats.tsx
git commit -m "feat(transparency): add TransparencyStats component"
```

---

### Task 7: Wire data fetching and mode in `MapDesktop`

**Files:**
- Modify: `frontend/src/components/city/MapDesktop.tsx`

This is the largest single-file change. Apply the steps in order.

- [ ] **Step 1: Add new imports**

At the top of `MapDesktop.tsx`, add to the existing imports:

```tsx
import { fetchCityBudgets, fetchCityContext, type BudgetYear, type MayorTerm } from '../../services/api';
import BudgetSunburst from './plots/BudgetSunburst';
import TransparencyStats from './map/modes/transparency/TransparencyStats';
import { buildSunburstTree } from '../../utils/budget';
```

- [ ] **Step 2: Add new mode registration entries**

Add `[MAP_MODES.TRANSPARENCY]` to the three lookup objects at the top of the file:

```tsx
const modeNames: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura',
    [MAP_MODES.TRAFFIC]: 'Modelo de Movilidad',
    [MAP_MODES.STATIONS]: 'Servicio Bici',
    [MAP_MODES.ACCIDENTS]: 'Accidentes',
    [MAP_MODES.TRANSPARENCY]: 'Transparencia',
};

const modeColors: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: '#027A76',
    [MAP_MODES.TRAFFIC]: '#3A6C7F',
    [MAP_MODES.STATIONS]: '#ffa585',
    [MAP_MODES.ACCIDENTS]: 'var(--red)',
    [MAP_MODES.TRANSPARENCY]: '#3A6C7F',
};

const modeGradients: Partial<Record<string, { bg: string; wave: string }>> = {
    [MAP_MODES.INFRASTRUCTURE]: { bg: 'linear-gradient(160deg, #027A76 0%, #3A6C7F 100%)', wave: '#027A76' },
    [MAP_MODES.STATIONS]:       { bg: 'linear-gradient(160deg, #ffa585 0%, #bc556f 100%)', wave: '#ffa585' },
    [MAP_MODES.TRAFFIC]:        { bg: 'linear-gradient(160deg, #003849 0%, #4b749f 100%)', wave: '#003849' },
    [MAP_MODES.TRANSPARENCY]:   { bg: 'linear-gradient(160deg, #1e2d5a 0%, #3A6C7F 100%)', wave: '#1e2d5a' },
};
```

- [ ] **Step 3: Add new state variables**

Inside the `MapDesktop` component, after the existing `const [infraStats, setInfraStats] = useState<InfraStats | null>(null);` line, add:

```tsx
const [budgetYears, setBudgetYears] = useState<BudgetYear[]>([]);
const [selectedYear, setSelectedYear] = useState<number>(0);
const [budgetType, setBudgetType] = useState<'planned' | 'executed'>('planned');
const [mayors, setMayors] = useState<MayorTerm[]>([]);
```

- [ ] **Step 4: Replace the infra stats fetch with a parallel fetch**

Remove the existing `useEffect` that calls `fetchInfraStats` and replace with:

```tsx
useEffect(() => {
    if (!city.id) return;
    Promise.all([
        fetchInfraStats(city.id).catch(() => null),
        fetchCityBudgets(city.id).catch(() => [] as BudgetYear[]),
        fetchCityContext(city.id).catch(() => ({ mayors: [] as MayorTerm[], budget_year: null, budget_categories: {} })),
    ]).then(([infraResult, budgetsResult, contextResult]) => {
        setInfraStats(infraResult);
        setBudgetYears(budgetsResult);
        if (budgetsResult.length > 0) {
            setSelectedYear(budgetsResult[budgetsResult.length - 1].year);
        }
        setMayors(contextResult.mayors);
    });
}, [city.id]);
```

- [ ] **Step 5: Update `isModeAvailable` to gate on budget data**

In the `isModeAvailable` function, add a check before the existing city.available_modes check:

```tsx
const isModeAvailable = (m: MapMode | string | null): boolean => {
    if (!m) return false;
    if (!modeNames[m]) return false;
    if (m === MAP_MODES.TRANSPARENCY) return budgetYears.length > 0;
    if (city.available_modes) return city.available_modes[m] === true;
    if (m === MAP_MODES.STATIONS) return (city.stations_count || 0) > 0;
    return false;
};
```

- [ ] **Step 6: Add sunburst overlay helper and update `mapEl`**

Add a `sunburstOverlay` JSX variable after the `selectedColor` line:

```tsx
const sunburstOverlay = mode === MAP_MODES.TRANSPARENCY && budgetYears.length > 0 && selectedYear > 0 ? (
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
) : null;
```

Update `mapEl` to add `locked`, `relative`, and the overlay:

```tsx
const mapEl = (
    <div className="h-[78vh] min-h-[560px] px-[var(--space-gutter)] relative">
        <CityMap
            city={city}
            selectedColor={selectedColor}
            onEdgeSelect={setSelectedEdgeId}
            locked={mode === MAP_MODES.TRANSPARENCY}
        />
        {sunburstOverlay}
    </div>
);
```

- [ ] **Step 7: Update `statsEl` to conditionally render `TransparencyStats`**

Replace the existing `statsEl` definition with:

```tsx
const statsEl = mode === MAP_MODES.TRANSPARENCY
    ? (
        <div className="px-[var(--space-gutter)] py-10">
            <TransparencyStats
                city={city}
                budgetYears={budgetYears}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                mayors={mayors}
            />
        </div>
    )
    : (
        <div className="px-[var(--space-gutter)] py-10">
            <ModeStatsRouter city={city} />
        </div>
    );
```

- [ ] **Step 8: Update the ultrawide DualPanel left panel**

In the `isUltrawide` branch, update `DualPanel.Left` to add `locked` and the overlay:

```tsx
<DualPanel.Left>
    <div className="sticky top-0 h-screen px-[var(--space-gutter)] pt-8 pb-6 relative">
        <CityMap
            city={city}
            selectedColor={selectedColor}
            onEdgeSelect={setSelectedEdgeId}
            locked={mode === MAP_MODES.TRANSPARENCY}
        />
        {sunburstOverlay}
    </div>
</DualPanel.Left>
```

And update `DualPanel.Right` to use the conditional stats:

```tsx
<DualPanel.Right>
    <div className="overflow-y-auto max-h-screen px-[var(--space-gutter)] pt-8 pb-6">
        <div className="mb-8">
            {filtersEl}
        </div>
        {mode === MAP_MODES.TRANSPARENCY
            ? (
                <TransparencyStats
                    city={city}
                    budgetYears={budgetYears}
                    selectedYear={selectedYear}
                    onYearChange={setSelectedYear}
                    mayors={mayors}
                />
            )
            : <ModeStatsRouter city={city} />
        }
    </div>
</DualPanel.Right>
```

- [ ] **Step 9: Verify TypeScript compiles with no errors**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors. Common issues to fix if they appear:
- `BudgetYear[]` type cast in Promise.all — add `as BudgetYear[]` if needed
- `MayorTerm[]` — imported from `../../services/api`

- [ ] **Step 10: Run full test suite**

```bash
cd frontend && npx vitest run --project unit 2>&1 | tail -20
```

Expected: all pre-existing tests pass plus the new `budget` and `BudgetDeltaChart` tests.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/city/MapDesktop.tsx
git commit -m "feat(transparency): wire Transparencia mode in MapDesktop"
```

---

## Self-Review Checklist (run before execution)

| Spec requirement | Task |
|---|---|
| Add TRANSPARENCY to MAP_MODES | Task 1 |
| modeNames / modeColors / modeGradients | Task 7, Step 2 |
| Scales icon + context copy in MapFilters | Task 5 |
| Data gating via budgetYears.length | Task 7, Step 5 |
| Parallel fetch: infraStats + budgets + context | Task 7, Step 4 |
| CityMap locked prop — no controls, no legend, no interaction | Task 4 |
| BudgetSunburst overlay on locked map | Task 7, Steps 6+8 |
| TransparencyStats: year selector | Task 6, Step 1 |
| TransparencyStats: metric cards | Task 6, Step 1 |
| BudgetDeltaChart: vertical diverging bars, delta = executed − planned | Task 3 |
| TransparencyStats: MayorsGanttChart | Task 6, Step 1 |
| Ultrawide DualPanel: locked map left, stats right | Task 7, Step 8 |
| ModeStatsRouter unchanged | Confirmed — Tasks 6+7 bypass it |
| buildSunburstTree helper + unit tests | Task 2 |
| BudgetDeltaChart unit tests | Task 3 |
