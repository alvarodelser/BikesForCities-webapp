# FilterCard Per-Option Methodology Breakdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat METODOLOGÍA string in the Generación and Enrutamiento FilterCards with an active-option-first display, a "Ver otros (N)" toggle, and a labeled list for the remaining options.

**Architecture:** All changes are confined to `TrafficStats.tsx`. `FilterCard` gets a new optional prop `helpComoSeRecogieronPerOption: Record<string, string>` that drives a new rendering branch in the METODOLOGÍA section. A second `useState<boolean>` (`othersExpanded`) handles the toggle, reset via `useEffect` when the help panel closes. The flat `helpComoSeRecogieron` prop stays as a fallback for future cards that don't need per-option breakdown.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest 3 + React Testing Library, jsdom

---

## File map

| Action | Path | What changes |
|---|---|---|
| Modify | `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx` | Export `FilterCard`, extend `FilterCardProps`, add `othersExpanded` state + rendering logic, update two call sites, add `ChevronDown`/`ChevronUp` to lucide import |
| Create | `frontend/src/components/city/map/modes/traffic/TrafficStats.test.tsx` | Unit tests for the new per-option methodology UI |

---

## Task 1: Export FilterCard and write failing tests

**Files:**
- Modify: `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx` (add `export`)
- Create: `frontend/src/components/city/map/modes/traffic/TrafficStats.test.tsx`

- [ ] **Step 1.1: Add `export` keyword to FilterCard and add the new prop to the interface**

In `TrafficStats.tsx`, make two minimal changes:

Change line 41 (`interface FilterCardProps {`) — add the new prop at the end of the interface:

```ts
interface FilterCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  options: { value: string; label: string; disabled?: boolean }[];
  activeValue: string | undefined;
  onSelect: (v: string) => void;
  helpQueVes?: string;
  helpPorQueEsUtil?: string;
  helpComoSeRecogieron?: string;
  helpComoSeRecogieronPerOption?: Record<string, string>;
}
```

Change line 53 (`function FilterCard({`) — add `export`:

```ts
export function FilterCard({
```

Also destructure the new prop at the top of the function (alongside the existing destructured props):

```ts
export function FilterCard({ icon: Icon, title, description, options, activeValue, onSelect, helpQueVes, helpPorQueEsUtil, helpComoSeRecogieron, helpComoSeRecogieronPerOption }: FilterCardProps) {
```

- [ ] **Step 1.2: Update `hasHelp` to include the new prop**

Find:
```ts
  const hasHelp = !!(helpQueVes || helpPorQueEsUtil || helpComoSeRecogieron);
```

Replace with:
```ts
  const hasHelp = !!(helpQueVes || helpPorQueEsUtil || helpComoSeRecogieron || helpComoSeRecogieronPerOption);
```

- [ ] **Step 1.3: Write the test file**

Create `frontend/src/components/city/map/modes/traffic/TrafficStats.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FilterCard } from './TrafficStats';
import { Network } from 'lucide-react';

const OPTIONS = [
  { value: 'real', label: 'GPS real' },
  { value: 'station_based', label: 'Estaciones' },
  { value: 'buildings_population', label: 'Población' },
];

const PER_OPTION = {
  real: 'GPS text.',
  station_based: 'Stations text.',
  buildings_population: 'Population text.',
};

function openHelp() {
  fireEvent.click(screen.getByRole('button', { name: /mostrar información/i }));
}

describe('FilterCard — per-option methodology', () => {
  it('shows the active option text in metodología when help is open', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    expect(screen.getByText('GPS text.')).toBeInTheDocument();
  });

  it('does not show other options text before toggle', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    expect(screen.queryByText('Stations text.')).not.toBeInTheDocument();
    expect(screen.queryByText('Population text.')).not.toBeInTheDocument();
  });

  it('shows "Ver otros (2)" toggle button', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    expect(screen.getByRole('button', { name: /ver otros \(2\)/i })).toBeInTheDocument();
  });

  it('expands other options on toggle click', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    fireEvent.click(screen.getByRole('button', { name: /ver otros/i }));
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    expect(screen.getByText('Population text.')).toBeInTheDocument();
  });

  it('collapses other options when toggle clicked again', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    fireEvent.click(screen.getByRole('button', { name: /ver otros/i }));
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver otros/i }));
    expect(screen.queryByText('Stations text.')).not.toBeInTheDocument();
  });

  it('shows all options equally when no activeValue', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue={undefined}
        onSelect={() => {}}
        helpQueVes="Qué ves."
        helpComoSeRecogieronPerOption={PER_OPTION}
      />,
    );
    openHelp();
    expect(screen.getByText('GPS text.')).toBeInTheDocument();
    expect(screen.getByText('Stations text.')).toBeInTheDocument();
    expect(screen.getByText('Population text.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver otros/i })).not.toBeInTheDocument();
  });

  it('falls back to flat text when only helpComoSeRecogieron is provided', () => {
    render(
      <FilterCard
        icon={Network}
        title="Generación"
        description="Desc"
        options={OPTIONS}
        activeValue="real"
        onSelect={() => {}}
        helpComoSeRecogieron="Flat fallback text."
      />,
    );
    openHelp();
    expect(screen.getByText('Flat fallback text.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 1.4: Run the tests and confirm they fail**

```bash
cd /Users/alvarodelser/Projects/BikesForCities/frontend && npx vitest run --project unit src/components/city/map/modes/traffic/TrafficStats.test.tsx
```

Expected: most tests FAIL because the rendering logic hasn't been implemented yet. The `falls back to flat text` test may already pass. The `helpComoSeRecogieronPerOption`-specific tests should fail with "Unable to find..." or similar.

---

## Task 2: Implement the per-option rendering logic

**Files:**
- Modify: `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx`

- [ ] **Step 2.1: Add `ChevronDown` and `ChevronUp` to the lucide import**

Find:
```ts
import { Navigation, Users, TrendingUp, Activity, Network, Route, HelpCircle, X } from 'lucide-react';
```

Replace with:
```ts
import { Navigation, Users, TrendingUp, Activity, Network, Route, HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
```

- [ ] **Step 2.2: Add `othersExpanded` state and reset effect inside `FilterCard`**

Find the existing state declaration inside `FilterCard`:
```ts
  const [expanded, setExpanded] = useState(false);
```

Replace with:
```ts
  const [expanded, setExpanded] = useState(false);
  const [othersExpanded, setOthersExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) setOthersExpanded(false);
  }, [expanded]);
```

- [ ] **Step 2.3: Replace the METODOLOGÍA rendering section**

Find this block inside `FilterCard`'s render (inside the `{expanded && hasHelp && (…)}` section):

```tsx
          {helpComoSeRecogieron && (
            <div>
              {sectionHead('METODOLOGÍA')}
              <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/75">{helpComoSeRecogieron}</p>
            </div>
          )}
```

Replace with:

```tsx
          {(helpComoSeRecogieron || helpComoSeRecogieronPerOption) && (
            <div>
              {sectionHead('METODOLOGÍA')}
              {helpComoSeRecogieronPerOption ? (
                activeValue && helpComoSeRecogieronPerOption[activeValue] ? (
                  <>
                    <div
                      className="rounded-lg px-2 py-1.5 mb-2"
                      style={{ backgroundColor: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }}
                    >
                      <span
                        className="text-[9px] font-black uppercase tracking-widest"
                        style={{ color: ACCENT }}
                      >
                        {options.find(o => o.value === activeValue)?.label ?? activeValue}
                      </span>
                      <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/75 mt-0.5">
                        {helpComoSeRecogieronPerOption[activeValue]}
                      </p>
                    </div>
                    {options.filter(o => o.value !== activeValue && helpComoSeRecogieronPerOption![o.value]).length > 0 && (
                      <button
                        onClick={() => setOthersExpanded(v => !v)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[var(--blue-dark)]/40 hover:text-[var(--blue-dark)]/65 transition-colors mt-1"
                        aria-label={othersExpanded ? 'Ver otros' : `Ver otros (${options.filter(o => o.value !== activeValue && helpComoSeRecogieronPerOption![o.value]).length})`}
                      >
                        {othersExpanded ? (
                          <><ChevronUp className="w-3 h-3" />Ver otros</>
                        ) : (
                          <><ChevronDown className="w-3 h-3" />Ver otros ({options.filter(o => o.value !== activeValue && helpComoSeRecogieronPerOption![o.value]).length})</>
                        )}
                      </button>
                    )}
                    {othersExpanded && (
                      <div className="mt-2 flex flex-col gap-2">
                        {options
                          .filter(o => o.value !== activeValue && helpComoSeRecogieronPerOption![o.value])
                          .map((o, i) => (
                            <div key={o.value} className={i > 0 ? 'border-t border-black/[0.06] pt-2' : ''}>
                              <p className="text-[10.5px] font-bold text-[var(--blue-dark)]/65">{o.label}</p>
                              <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/55">
                                {helpComoSeRecogieronPerOption![o.value]}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    {options
                      .filter(o => helpComoSeRecogieronPerOption![o.value])
                      .map((o, i) => (
                        <div key={o.value} className={i > 0 ? 'border-t border-black/[0.06] pt-2' : ''}>
                          <p className="text-[10.5px] font-bold text-[var(--blue-dark)]/65">{o.label}</p>
                          <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/55">
                            {helpComoSeRecogieronPerOption![o.value]}
                          </p>
                        </div>
                      ))}
                  </div>
                )
              ) : (
                <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/75">{helpComoSeRecogieron}</p>
              )}
            </div>
          )}
```

- [ ] **Step 2.4: Run the tests and confirm they pass**

```bash
cd /Users/alvarodelser/Projects/BikesForCities/frontend && npx vitest run --project unit src/components/city/map/modes/traffic/TrafficStats.test.tsx
```

Expected: all 7 tests PASS.

---

## Task 3: Update the two call sites with per-option content

**Files:**
- Modify: `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx`

- [ ] **Step 3.1: Update the Generación FilterCard call site**

Find the `helpComoSeRecogieron` prop on the Generación `FilterCard`:

```tsx
          helpComoSeRecogieron="Real: trayectos GPS del sistema de bici pública proyectados al nodo más cercano de la red (tolerancia 150 m). Estaciones: viajes sintetizados a partir de flujos de entrada/salida por estación. Población: modelo de gravedad donde la probabilidad de viaje es proporcional a la densidad de edificios del origen, la densidad de población del destino e inversamente proporcional a la distancia."
```

Replace it with the per-option version (remove `helpComoSeRecogieron`, add `helpComoSeRecogieronPerOption`):

```tsx
          helpComoSeRecogieronPerOption={{
            real: 'Trayectos GPS del sistema de bici pública proyectados al nodo más cercano de la red (tolerancia 150 m).',
            station_based: 'Viajes sintetizados a partir de flujos de entrada/salida por estación.',
            buildings_population: 'Modelo de gravedad donde la probabilidad de viaje es proporcional a la densidad de edificios del origen, la densidad de población del destino e inversamente proporcional a la distancia.',
          }}
```

- [ ] **Step 3.2: Update the Enrutamiento FilterCard call site**

Find the `helpComoSeRecogieron` prop on the Enrutamiento `FilterCard`:

```tsx
            helpComoSeRecogieron="Map-matched: cada viaje GPS se ancla a los nodos más cercanos a inicio y fin (tolerancia 150 m); la ruta se resuelve por distancia mínima. Ruta corta: Dijkstra con peso = longitud en metros. Ruta segura: Dijkstra con route_cost = length × (1 + peligrosidad × ln(max(length,1)) / 144); la peligrosidad depende del tipo de vía, velocidad máxima y número de carriles."
```

Replace it:

```tsx
            helpComoSeRecogieronPerOption={{
              map_matched: 'Cada viaje GPS se ancla a los nodos más cercanos a inicio y fin (tolerancia 150 m); la ruta se resuelve por distancia mínima.',
              shortest: 'Dijkstra con peso = longitud en metros.',
              safest: 'Dijkstra con route_cost = length × (1 + peligrosidad × ln(max(length,1)) / 144); la peligrosidad depende del tipo de vía, velocidad máxima y número de carriles.',
            }}
```

- [ ] **Step 3.3: Run the full unit test suite**

```bash
cd /Users/alvarodelser/Projects/BikesForCities/frontend && npx vitest run --project unit
```

Expected: all tests pass (no regressions).

- [ ] **Step 3.4: TypeScript check**

```bash
cd /Users/alvarodelser/Projects/BikesForCities/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3.5: Commit**

```bash
git add frontend/src/components/city/map/modes/traffic/TrafficStats.tsx frontend/src/components/city/map/modes/traffic/TrafficStats.test.tsx
git commit -m "feat: per-option methodology breakdown in Generación and Enrutamiento filter cards"
```
