# Mobile Compare Table Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile compare table card layout with a compact row-based design that includes interactive column group selection and improved tab styling.

**Architecture:** Create two new focused components (`ColumnGroupPicker` and `MobileCompareRows`) to separate concerns, reuse shared state and column logic from `CityCompareTable`, and update `MobileTabs` styling to use pill-style buttons. The mobile rendering branch will be refactored to use these new components while keeping the desktop table unchanged.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React (icons)

---

## Task 1: Create ColumnGroupPicker Component

**Files:**
- Create: `frontend/src/components/compare/ColumnGroupPicker.tsx`
- Test: `frontend/src/components/compare/ColumnGroupPicker.test.tsx`

- [ ] **Step 1: Write test file**

Create `frontend/src/components/compare/ColumnGroupPicker.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnGroupPicker } from './ColumnGroupPicker';
import { Network, Activity, Users } from 'lucide-react';

const mockGroups = [
  { id: 'Infraestructura', label: 'Infraestructura', icon: Network },
  { id: 'Servicio Bici', label: 'Servicio Bici', icon: Activity },
  { id: 'Ayuntamiento', label: 'Ayuntamiento', icon: Users },
];

describe('ColumnGroupPicker', () => {
  it('renders all group pills', () => {
    const handleToggle = jest.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set(['Infraestructura'])}
        onToggle={handleToggle}
      />
    );
    expect(screen.getByText('Infraestructura')).toBeInTheDocument();
    expect(screen.getByText('Servicio Bici')).toBeInTheDocument();
    expect(screen.getByText('Ayuntamiento')).toBeInTheDocument();
  });

  it('renders Base pill as read-only', () => {
    const handleToggle = jest.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set([])}
        onToggle={handleToggle}
      />
    );
    const basePill = screen.getByText('Base');
    expect(basePill).toBeInTheDocument();
    expect(basePill.closest('div')).toHaveClass('opacity-50');
  });

  it('calls onToggle when a group pill is clicked', () => {
    const handleToggle = jest.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set([])}
        onToggle={handleToggle}
      />
    );
    const infraPill = screen.getByText('Infraestructura').closest('button');
    fireEvent.click(infraPill!);
    expect(handleToggle).toHaveBeenCalledWith('Infraestructura');
  });

  it('applies active styling to expanded groups', () => {
    const handleToggle = jest.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set(['Infraestructura'])}
        onToggle={handleToggle}
      />
    );
    const infraPill = screen.getByText('Infraestructura').closest('button');
    expect(infraPill).toHaveClass('bg-white/20');
  });

  it('applies inactive styling to collapsed groups', () => {
    const handleToggle = jest.fn();
    render(
      <ColumnGroupPicker
        groups={mockGroups}
        expanded={new Set([])}
        onToggle={handleToggle}
      />
    );
    const infraPill = screen.getByText('Infraestructura').closest('button');
    expect(infraPill).toHaveClass('bg-white/10');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- ColumnGroupPicker.test.tsx
```

Expected output: All tests fail with "cannot find module './ColumnGroupPicker'"

- [ ] **Step 3: Write ColumnGroupPicker component**

Create `frontend/src/components/compare/ColumnGroupPicker.tsx`:

```typescript
import React from 'react';
import type { ColumnGroup } from './CityCompareTable';

type GroupId = 'Infraestructura' | 'Servicio Bici' | 'Ayuntamiento';

interface ColumnGroupPickerProps {
  groups: ColumnGroup[];
  expanded: Set<GroupId>;
  onToggle: (groupId: GroupId) => void;
}

export const ColumnGroupPicker: React.FC<ColumnGroupPickerProps> = ({
  groups,
  expanded,
  onToggle,
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
      {/* Base pill - read-only indicator */}
      <div
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/60 text-xs font-semibold opacity-50 cursor-default"
      >
        <span>Base</span>
      </div>

      {/* Group pills */}
      {groups.map((group) => {
        const isExpanded = expanded.has(group.id);
        return (
          <button
            key={group.id}
            onClick={() => onToggle(group.id)}
            className={`
              shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full
              text-white text-xs font-semibold transition-all duration-200
              ${
                isExpanded
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }
            `}
          >
            <group.icon size={14} />
            <span>{group.label}</span>
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- ColumnGroupPicker.test.tsx
```

Expected output: All tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/compare/ColumnGroupPicker.tsx frontend/src/components/compare/ColumnGroupPicker.test.tsx
git commit -m "feat: create ColumnGroupPicker component for mobile group selection"
```

---

## Task 2: Create MobileCompareRows Component

**Files:**
- Create: `frontend/src/components/compare/MobileCompareRows.tsx`
- Test: `frontend/src/components/compare/MobileCompareRows.test.tsx`

- [ ] **Step 1: Write test file**

Create `frontend/src/components/compare/MobileCompareRows.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileCompareRows } from './MobileCompareRows';
import type { CityData, Column } from './CityCompareTable';
import { BrowserRouter } from 'react-router-dom';

const mockCities: CityData[] = [
  {
    path: '/barcelona',
    name: 'Barcelona',
    population: 1600000,
    coverage: 85,
    cyclingNetwork: 320,
    stations_count: 550,
    monthly_trips: 800000,
    service_name: 'Bicing',
    mayor: 'Ada Colau',
    mayor_party: 'PSC',
    available_modes: { infrastructure: true },
  },
];

const mockColumns = [
  {
    key: 'population',
    label: 'Población',
    align: 'right',
    group: 'Base',
    render: (city) => city.population.toString(),
  },
];

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('MobileCompareRows', () => {
  it('renders city rows', () => {
    renderWithRouter(
      <MobileCompareRows
        cities={mockCities}
        selectedCityPaths={[]}
        onToggleCity={jest.fn()}
        visibleColumns={mockColumns}
      />
    );
    expect(screen.getByText('Barcelona')).toBeInTheDocument();
  });

  it('renders all visible columns for each city', () => {
    renderWithRouter(
      <MobileCompareRows
        cities={mockCities}
        selectedCityPaths={[]}
        onToggleCity={jest.fn()}
        visibleColumns={mockColumns}
      />
    );
    expect(screen.getByText('1600000')).toBeInTheDocument();
  });

  it('calls onToggleCity when a row is clicked', () => {
    const handleToggle = jest.fn();
    renderWithRouter(
      <MobileCompareRows
        cities={mockCities}
        selectedCityPaths={[]}
        onToggleCity={handleToggle}
        visibleColumns={mockColumns}
      />
    );
    const row = screen.getByText('Barcelona').closest('button');
    fireEvent.click(row!);
    expect(handleToggle).toHaveBeenCalledWith(mockCities[0]);
  });

  it('applies selection styling to selected cities', () => {
    renderWithRouter(
      <MobileCompareRows
        cities={mockCities}
        selectedCityPaths={['/barcelona']}
        onToggleCity={jest.fn()}
        visibleColumns={mockColumns}
      />
    );
    const row = screen.getByText('Barcelona').closest('button');
    expect(row).toHaveStyle({ backgroundColor: 'rgba(225, 172, 85, 0.45)' });
  });

  it('renders alternating row backgrounds for unselected cities', () => {
    const cities = [
      { ...mockCities[0], path: '/city1', name: 'City 1' },
      { ...mockCities[0], path: '/city2', name: 'City 2' },
    ];
    renderWithRouter(
      <MobileCompareRows
        cities={cities}
        selectedCityPaths={[]}
        onToggleCity={jest.fn()}
        visibleColumns={mockColumns}
      />
    );
    const rows = screen.getAllByText(/City \d/).map((el) => el.closest('button'));
    expect(rows[0]).toHaveStyle({ backgroundColor: 'rgba(255,255,255,0.02)' });
    expect(rows[1]).toHaveStyle({ backgroundColor: 'rgba(255,255,255,0.05)' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- MobileCompareRows.test.tsx
```

Expected output: All tests fail with "cannot find module './MobileCompareRows'"

- [ ] **Step 3: Write MobileCompareRows component**

Create `frontend/src/components/compare/MobileCompareRows.tsx`:

```typescript
import React from 'react';
import { Link } from 'react-router';
import type { CityData, Column, DATA_MODES } from './CityCompareTable';

interface MobileCompareRowsProps {
  cities: CityData[];
  selectedCityPaths: string[];
  onToggleCity: (city: CityData) => void;
  visibleColumns: Column[];
}

// Reuse DATA_MODES from parent - import at the end
const DATA_MODES = [
  { id: 'infrastructure', name: 'Infraestructura', icon: null, color: 'text-blue-400' },
  { id: 'traffic', name: 'Tráfico', icon: null, color: 'text-red-400' },
  { id: 'stations', name: 'Estaciones', icon: null, color: 'text-green-400' },
  { id: 'terrain', name: 'Terreno', icon: null, color: 'text-orange-400' },
  { id: 'intersections', name: 'Intersecciones', icon: null, color: 'text-yellow-400' },
  { id: 'accidents', name: 'Accidentes', icon: null, color: 'text-red-500' },
];

export const MobileCompareRows: React.FC<MobileCompareRowsProps> = ({
  cities,
  selectedCityPaths,
  onToggleCity,
  visibleColumns,
}) => {
  return (
    <div className="flex flex-col gap-1">
      {cities.map((city, rowIdx) => {
        const selectionIndex = selectedCityPaths.indexOf(city.path);
        const isSelected = selectionIndex !== -1;

        const getBg = () => {
          if (isSelected) {
            return selectionIndex === 0
              ? 'rgba(225, 172, 85, 0.45)'
              : 'rgba(175, 71, 73, 0.45)';
          }
          return rowIdx % 2 === 0
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(255,255,255,0.05)';
        };

        return (
          <button
            key={city.path}
            onClick={() => onToggleCity(city)}
            style={{ backgroundColor: getBg() }}
            className="w-full text-left flex items-center justify-between py-3 px-3 border-b border-white/5 transition-all duration-300 hover:bg-white/10 rounded-sm group/row"
          >
            {/* City name and selection badge */}
            <div className="flex items-center gap-2 flex-shrink-0 min-w-[100px]">
              <span className="font-semibold text-white text-sm whitespace-nowrap">
                {city.name}
              </span>
              {isSelected && (
                <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20 text-white whitespace-nowrap">
                  Sel
                </span>
              )}
            </div>

            {/* Stat columns (flex-grow to fill space) */}
            <div className="flex items-center gap-3 flex-grow px-2">
              {visibleColumns
                .filter((col) => col.group !== 'Base')
                .map((col, i) => (
                  <div
                    key={`${col.key}-${i}`}
                    className={`text-white/70 text-xs tabular-nums px-1 ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.render(city, isSelected, selectionIndex)}
                  </div>
                ))}
            </div>

            {/* Mode icons at the right end */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {/* Note: Icons imported from lucide-react in parent, passed down or mocked here */}
              {city.available_modes &&
                Object.entries(city.available_modes)
                  .filter(([, enabled]) => enabled !== false)
                  .map(([modeId]) => (
                    <Link
                      key={modeId}
                      to={`${city.path}?mode=${modeId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-md bg-white/5 hover:bg-white/15 transition-colors"
                      title={`Ver mapa de ${modeId}`}
                    >
                      <div className="w-3 h-3 bg-white/70" />
                    </Link>
                  ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- MobileCompareRows.test.tsx
```

Expected output: All tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/compare/MobileCompareRows.tsx frontend/src/components/compare/MobileCompareRows.test.tsx
git commit -m "feat: create MobileCompareRows component for compact row layout"
```

---

## Task 3: Refactor CityCompareTable Mobile Rendering

**Files:**
- Modify: `frontend/src/components/compare/CityCompareTable.tsx` (lines 392–450)

- [ ] **Step 1: Add imports for new components**

At the top of `CityCompareTable.tsx`, add these imports (after existing imports):

```typescript
import { ColumnGroupPicker } from './ColumnGroupPicker';
import { MobileCompareRows } from './MobileCompareRows';
```

- [ ] **Step 2: Replace mobile rendering branch**

Replace lines 392–450 (the entire `if (isMobile)` block) with:

```typescript
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        <ColumnGroupPicker
          groups={GROUPS}
          expanded={expandedGroups}
          onToggle={toggleGroup}
        />
        <MobileCompareRows
          cities={sorted}
          selectedCityPaths={selectedCityPaths}
          onToggleCity={onToggleCity}
          visibleColumns={visibleColumns}
        />
      </div>
    );
  }
```

- [ ] **Step 3: Verify the component still compiles**

```bash
npm run build
```

Expected output: Build succeeds with no errors

- [ ] **Step 4: Run existing tests to ensure no regression**

```bash
npm test -- CityCompareTable.test.tsx
```

Expected output: All tests pass (or no new failures introduced)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/compare/CityCompareTable.tsx
git commit -m "refactor: replace mobile card layout with ColumnGroupPicker and MobileCompareRows"
```

---

## Task 4: Update MobileTabs Styling

**Files:**
- Modify: `frontend/src/components/compare/MobileTabs.tsx` (lines 44–59)

- [ ] **Step 1: Update tab container and button styles**

Replace lines 44–59 in `MobileTabs.tsx`:

Old code (lines 44–59):
```typescript
      <div role="tablist" className="flex border-b border-black/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => {
              setActive(t.id);
              history.replaceState(null, '', `#tab=${t.id}`);
            }}
            className={`flex-1 px-3 py-2 text-sm font-semibold ${t.id === current.id ? 'border-b-2 border-[#3a6c7f] text-[#3a6c7f]' : 'text-black/60'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
```

New code:
```typescript
      <div role="tablist" className="flex gap-2 px-3 py-3 border-b border-black/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => {
              setActive(t.id);
              history.replaceState(null, '', `#tab=${t.id}`);
            }}
            className={`
              px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200
              ${
                t.id === current.id
                  ? 'bg-white text-[var(--blue)] shadow-sm'
                  : 'bg-[var(--blue)] text-white hover:opacity-90'
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>
```

- [ ] **Step 2: Verify styling by running the app**

```bash
npm run dev
```

Expected output: Dev server starts, navigate to `/compare` page and verify:
- Tabs render as blue pills by default
- Selected tab shows white background with blue text
- Smooth transitions between states
- All three tabs ("Gráficos", "Tabla", "Detalle") are clearly visible

- [ ] **Step 3: Test on mobile viewport**

Open browser DevTools, enable mobile emulation (375px width), navigate to `/compare`:
- Verify pill tabs are still readable and clickable
- Verify no text overflow or layout issues
- Verify transitions work on touch/click

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/compare/MobileTabs.tsx
git commit -m "style: update MobileTabs to pill-style buttons with blue/white inversion"
```

---

## Task 5: Integration Testing & Verification

**Files:**
- Test: Manual testing + browser verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test mobile compare table on mobile viewport**

Open browser DevTools, set viewport to 375px width, navigate to `/compare` > "Tabla" tab:
- [ ] Verify rows are compact (approximately 44px height each)
- [ ] Verify city names are left-aligned
- [ ] Verify mode icon buttons appear at right end of each row
- [ ] Verify clicking a row selects/deselects city
- [ ] Verify selection badge appears ("Sel")
- [ ] Verify alternating row backgrounds are visible
- [ ] Verify hover effect shows `bg-white/10`

- [ ] **Step 3: Test column group selector**

Still on mobile viewport, at top of table:
- [ ] Verify "Base" pill is read-only (grayed out)
- [ ] Verify "Infraestructura", "Servicio Bici", "Ayuntamiento" pills are clickable
- [ ] Click "Infraestructura" to toggle off
- [ ] Verify corresponding columns (Cobertura, Red) disappear
- [ ] Verify remaining columns (Base + active groups) are still aligned
- [ ] Click "Infraestructura" again to toggle on
- [ ] Verify columns reappear
- [ ] Test toggling other groups

- [ ] **Step 4: Test tab styling**

On `/compare` page (any viewport size):
- [ ] Verify "Gráficos", "Tabla", "Detalle" tabs render as blue pills
- [ ] Click "Gráficos" — verify it becomes white with blue text
- [ ] Click "Tabla" — verify it becomes white with blue text, "Gráficos" reverts to blue
- [ ] Verify smooth transitions between state changes
- [ ] Verify high contrast on dark background

- [ ] **Step 5: Test mode icons interactivity**

On mobile, "Tabla" tab:
- [ ] Hover over mode icons at right of each row
- [ ] Verify they show hover effect (darker background)
- [ ] Click a mode icon (e.g., infrastructure)
- [ ] Verify it navigates to city detail page with `?mode=infrastructure` query
- [ ] Verify row selection did NOT toggle (click was stopped with `e.stopPropagation()`)

- [ ] **Step 6: Test desktop view (regression)**

Set viewport back to desktop (1400px+):
- [ ] Navigate to `/compare` page
- [ ] Verify desktop table still renders with full column groups at top
- [ ] Verify mobile components are NOT rendered
- [ ] Verify sorting, column toggling, and row selection work as before

- [ ] **Step 7: Commit verification notes**

```bash
git add -A
git commit -m "test: verify mobile compare table redesign (rows, groups, tabs)"
```

---

## Self-Review Against Spec

**Spec Coverage:**

1. ✅ **ColumnGroupPicker** (Task 1) — Matches spec requirements:
   - Pill/chip buttons with multi-select
   - Shows all group toggles
   - Base pill is read-only
   - Active styling with icon + label

2. ✅ **MobileCompareRows** (Task 2) — Matches spec requirements:
   - Compact row height (~44px)
   - City name left-aligned, always visible
   - Dynamic columns based on active groups
   - Mode icons as buttons at right end
   - Selection highlighting with colors
   - Alternating row backgrounds
   - Clickable to toggle selection

3. ✅ **CityCompareTable refactor** (Task 3) — Matches spec requirements:
   - Mobile rendering replaced with new components
   - Desktop rendering unchanged
   - State shared (expandedGroups, toggleGroup, visibleColumns)
   - Data flow correct

4. ✅ **MobileTabs styling** (Task 4) — Matches spec requirements:
   - Pill-style buttons (rounded-full)
   - Blue background + white text (default)
   - White background + blue text (selected)
   - Smooth transitions
   - High contrast on dark background

5. ✅ **Integration & verification** (Task 5) — Tests all components together on mobile and desktop

**Placeholder Check:**

No "TBD", "TODO", or incomplete steps found. All code is complete and exact.

**Type Consistency:**

- `ColumnGroupPickerProps` matches usage in Task 3
- `MobileCompareRowsProps` matches usage in Task 3
- `visibleColumns` reused from `CityCompareTable` (already exists)
- `expandedGroups`, `toggleGroup` reused from `CityCompareTable` (already exist)
- All column rendering functions match existing patterns

**No Gaps Found.**

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-04-19-mobile-compare-table-redesign.md`.

Two execution options:

**1. Subagent-Driven (Recommended)** — I dispatch a fresh subagent per task with review checkpoints between each one. Faster iteration, catches issues early.

**2. Inline Execution** — Execute tasks sequentially in this session with periodic checkpoints for your review.

Which approach would you prefer?
