# Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roll out mobile / desktop / ultrawide responsive behavior across the whole frontend (navbar, footer, landing, city, compare, about, 404) without regressing the current desktop UX.

**Architecture:** Three-tier breakpoints driven by a single `useViewport` hook and Tailwind 4 `@theme` tokens. Structural layout swaps (navbar mobile, SideCardTail, DualPanel, MobileTabs) are extracted as primitives living next to their consumer; cosmetic spacing/caps use CSS custom properties. Maps add mobile-specific overlays (legend toggle, vertical controls) without forking desktop code. Chart-library selection is deferred; `<ResponsiveChart>` exposes a band (`narrow | medium | wide`) via container queries for future use.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS 4 (`@theme`), MapLibre GL, D3 (Spain map), Three.js (WaveBackground), Vitest + Storybook + Playwright.

**Reference spec:** `docs/superpowers/specs/2026-04-18-responsive-design-design.md`

---

## File Map

**New files:**
- `frontend/src/hooks/useViewport.ts` + `useViewport.test.ts`
- `frontend/src/components/landing/SideCardTail.tsx` + `.stories.tsx`
- `frontend/src/components/city/DualPanel.tsx` + `.stories.tsx`
- `frontend/src/components/compare/MobileTabs.tsx` + `.stories.tsx` + `.test.tsx`
- `frontend/src/components/ui/ResponsiveChart.tsx` + `.stories.tsx`
- `frontend/src/tests/responsive.spec.ts` (Playwright)

**Modified files:**
- `frontend/src/styles/theme.css`
- `frontend/src/components/layout/Navbar.tsx`, `Footer.tsx`
- `frontend/src/pages/AboutPage.tsx`, `NotFoundPage.tsx`, `CityPage.tsx`, `ComparePage.tsx`
- `frontend/src/components/landing/HeroSection.tsx`, `MapSelector.tsx`, `SpainMap.tsx`
- `frontend/src/components/ui/WaveBackground.tsx`
- `frontend/src/components/city/OverviewSection.tsx`, `MapSection.tsx`, `MapFilters.tsx`, `CityMap.tsx`, `MapControls.tsx`, `CityStats.tsx`
- `frontend/src/components/city/map/CityLegend.tsx`
- `frontend/src/components/compare/CityCompareTable.tsx`

**Out of scope:** `StatusPage.tsx`, actual chart implementations, dark mode, i18n, backend.

---

## Commit Convention

Use the repo's existing style (imperative short subject, optional body). Every task ends with a commit. Run `cd frontend && npm run lint && npm run typecheck` before each commit; fix any fallout in the same commit.

---

## Task 1: Breakpoint + layout tokens

**Files:**
- Modify: `frontend/src/styles/theme.css`

- [ ] **Step 1: Add breakpoint + layout tokens inside existing `@theme` block**

Open `frontend/src/styles/theme.css` and add to the `@theme` block:

```css
--breakpoint-3xl: 1920px;

--container-reading: 72ch;
--container-data:    100%;
--container-max:     1440px;
--space-section-y:   clamp(2rem, 4vw, 5rem);
--space-gutter:      clamp(1rem, 4vw, 6rem);
```

- [ ] **Step 2: Verify tokens compile**

Run: `cd frontend && npm run typecheck && npm run build`
Expected: build succeeds; `3xl:` prefix now available.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/theme.css
git commit -m "Add breakpoint and layout tokens for responsive design"
```

---

## Task 2: useViewport hook

**Files:**
- Create: `frontend/src/hooks/useViewport.ts`
- Create: `frontend/src/hooks/useViewport.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/useViewport.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useViewport } from './useViewport';

type Listener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(initial: Record<string, boolean>) {
  const listeners: Record<string, Set<Listener>> = {};
  const state = { ...initial };
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: state[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: (_e: string, l: Listener) => {
      (listeners[query] ??= new Set()).add(l);
    },
    removeEventListener: (_e: string, l: Listener) => {
      listeners[query]?.delete(l);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
  return {
    set(query: string, matches: boolean) {
      state[query] = matches;
      listeners[query]?.forEach((l) =>
        l({ matches } as MediaQueryListEvent),
      );
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useViewport', () => {
  it('returns mobile below 768px', () => {
    mockMatchMedia({ '(min-width: 768px)': false, '(min-width: 1920px)': false });
    const { result } = renderHook(() => useViewport());
    expect(result.current.tier).toBe('mobile');
    expect(result.current.isMobile).toBe(true);
  });

  it('returns desktop between 768 and 1920', () => {
    mockMatchMedia({ '(min-width: 768px)': true, '(min-width: 1920px)': false });
    const { result } = renderHook(() => useViewport());
    expect(result.current.tier).toBe('desktop');
    expect(result.current.isDesktop).toBe(true);
  });

  it('returns ultrawide above 1920px', () => {
    mockMatchMedia({ '(min-width: 768px)': true, '(min-width: 1920px)': true });
    const { result } = renderHook(() => useViewport());
    expect(result.current.tier).toBe('ultrawide');
    expect(result.current.isUltrawide).toBe(true);
  });

  it('updates on media-query change', () => {
    const mm = mockMatchMedia({ '(min-width: 768px)': false, '(min-width: 1920px)': false });
    const { result } = renderHook(() => useViewport());
    expect(result.current.tier).toBe('mobile');
    act(() => mm.set('(min-width: 768px)', true));
    expect(result.current.tier).toBe('desktop');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/hooks/useViewport.test.ts`
Expected: FAIL — module `./useViewport` not found.

- [ ] **Step 3: Write the hook**

Create `frontend/src/hooks/useViewport.ts`:

```ts
import { useEffect, useState } from 'react';

export type ViewportTier = 'mobile' | 'desktop' | 'ultrawide';

export interface Viewport {
  tier: ViewportTier;
  isMobile: boolean;
  isDesktop: boolean;
  isUltrawide: boolean;
}

const DESKTOP_Q = '(min-width: 768px)';
const ULTRA_Q = '(min-width: 1920px)';

function tierFrom(desktop: boolean, ultra: boolean): ViewportTier {
  if (ultra) return 'ultrawide';
  if (desktop) return 'desktop';
  return 'mobile';
}

function readTier(): ViewportTier {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop';
  return tierFrom(
    window.matchMedia(DESKTOP_Q).matches,
    window.matchMedia(ULTRA_Q).matches,
  );
}

export function useViewport(): Viewport {
  const [tier, setTier] = useState<ViewportTier>(readTier);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const desktopMQ = window.matchMedia(DESKTOP_Q);
    const ultraMQ = window.matchMedia(ULTRA_Q);
    const update = () => setTier(tierFrom(desktopMQ.matches, ultraMQ.matches));
    desktopMQ.addEventListener('change', update);
    ultraMQ.addEventListener('change', update);
    update();
    return () => {
      desktopMQ.removeEventListener('change', update);
      ultraMQ.removeEventListener('change', update);
    };
  }, []);

  return {
    tier,
    isMobile: tier === 'mobile',
    isDesktop: tier === 'desktop',
    isUltrawide: tier === 'ultrawide',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/hooks/useViewport.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useViewport.ts frontend/src/hooks/useViewport.test.ts
git commit -m "Add useViewport hook for tier-aware responsive behavior"
```

---

## Task 3: Navbar mobile branch

**Files:**
- Modify: `frontend/src/components/layout/Navbar.tsx`

Goal: at `< 768px`, the centered pill becomes the only navbar state. Tapping the burger expands the pill downward (reusing the existing `max-h` transition). Inside, `Inicio`, `Ciudades ▾`, `Compara`, `Acerca de`. `Ciudades ▾` expands further downward into an indented scrollable city list.

- [ ] **Step 1: Read current Navbar to understand the existing scrolled-pill transition**

Run: `sed -n '1,250p' frontend/src/components/layout/Navbar.tsx`
Note the transition class used for the city dropdown's `max-h`; reuse it.

- [ ] **Step 2: Add mobile branch to Navbar**

Introduce `useViewport` and branch on `isMobile`. Pseudocode:

```tsx
import { useViewport } from '../../hooks/useViewport';
const { isMobile } = useViewport();
// existing burger-open state + cities-open state are reused for mobile.
// Render a single centered-pill layout on mobile, with the same
// background/border/shadow as the desktop scrolled pill.
// The expand-downward behavior for top-level links (Inicio / Ciudades / Compara / Acerca)
// uses the same max-h transition already implemented for Ciudades on desktop.
// Inside, Ciudades ▾ has its own max-h transition to reveal the city sublist.
// Tap targets: each top-level link ≥ 44px height; city rows may be smaller (32–36px).
```

Implementation notes:
- Do not create a new component; keep the branching inside `Navbar.tsx`.
- Reuse the existing city list data source (the same array feeding the desktop Ciudades dropdown).
- Close the burger + cities submenu on route change.
- Outside click and Escape key close the open menus (if not already present, add it).
- On desktop and ultrawide, behavior is unchanged.

- [ ] **Step 3: Manual verification**

Run: `cd frontend && npm run dev`. In browser dev-tools device toolbar:
- Toggle device to iPhone 12 Pro (390×844). Confirm: centered pill, burger expands downward, city submenu indents + scrolls, ≥1 city link navigates correctly.
- Toggle to 1280×800. Confirm desktop is unchanged.
- Toggle to 2560×1440. Confirm ultrawide pill is still centered.

- [ ] **Step 4: Run lint + typecheck**

Run: `cd frontend && npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Navbar.tsx
git commit -m "Add mobile navbar branch with nested cities submenu"
```

---

## Task 4: Footer, About, 404 retrofit

**Files:**
- Modify: `frontend/src/components/layout/Footer.tsx`
- Modify: `frontend/src/pages/AboutPage.tsx`
- Modify: `frontend/src/pages/NotFoundPage.tsx`

- [ ] **Step 1: Footer — stack columns on mobile, cap width on desktop+**

In `Footer.tsx`, replace the existing column grid with:

```tsx
<div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--space-gutter)] py-[var(--space-section-y)]">
  <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
    {/* existing 3 column blocks */}
  </div>
</div>
```

Social icons row stays `flex flex-row`. Copyright pill wraps via `flex-wrap` if not already.

- [ ] **Step 2: AboutPage — cap reading width**

In `AboutPage.tsx`, wrap the text container in `max-w-[var(--container-reading)]` and replace any hard-coded horizontal padding with `px-[var(--space-gutter)]`. Multi-column content (if any) should stack on mobile.

- [ ] **Step 3: NotFoundPage — gutters + full-height centering**

Apply `px-[var(--space-gutter)] py-[var(--space-section-y)] min-h-screen flex items-center justify-center` to the root. Content block centered with `text-center`.

- [ ] **Step 4: Manual verification across 375 / 1280 / 2400 px.**

- [ ] **Step 5: Run lint + typecheck, then commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/layout/Footer.tsx frontend/src/pages/AboutPage.tsx frontend/src/pages/NotFoundPage.tsx
git commit -m "Make Footer, About, and 404 pages responsive"
```

---

## Task 5: SideCardTail primitive

**Files:**
- Create: `frontend/src/components/landing/SideCardTail.tsx`
- Create: `frontend/src/components/landing/SideCardTail.stories.tsx`

- [ ] **Step 1: Write SideCardTail**

Create `frontend/src/components/landing/SideCardTail.tsx`:

```tsx
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useViewport } from '../../hooks/useViewport';

interface Rect { left: number; top: number; width: number; height: number; }
interface Layout { side: 'left' | 'right'; card: Rect; ray: [number, number][]; }

const CARD_WIDTH = 320;
const CARD_MARGIN = 24;
const RAY_HALF_HEIGHT = 20;
const VIEWPORT_MARGIN = 16;

function computeLayout(target: DOMRect, cardH: number, viewportW: number, viewportH: number, preferred: 'auto' | 'left' | 'right'): Layout {
  const targetCX = target.left + target.width / 2;
  const targetCY = target.top + target.height / 2;
  const side = preferred === 'auto' ? (targetCX < viewportW / 2 ? 'left' : 'right') : preferred;

  const cardLeft = side === 'left'
    ? Math.max(CARD_MARGIN, targetCX - CARD_MARGIN - CARD_WIDTH)
    : Math.min(viewportW - CARD_WIDTH - CARD_MARGIN, targetCX + CARD_MARGIN);
  const cardTop = Math.min(
    Math.max(VIEWPORT_MARGIN, targetCY - cardH / 2),
    viewportH - cardH - VIEWPORT_MARGIN,
  );

  const innerEdgeX = side === 'left' ? cardLeft + CARD_WIDTH : cardLeft;
  const ray: [number, number][] = [
    [targetCX, targetCY],
    [innerEdgeX, targetCY - RAY_HALF_HEIGHT],
    [innerEdgeX, targetCY + RAY_HALF_HEIGHT],
  ];

  return { side, card: { left: cardLeft, top: cardTop, width: CARD_WIDTH, height: cardH }, ray };
}

export interface SideCardTailProps {
  targetRef: RefObject<Element | null>;
  visible: boolean;
  side?: 'auto' | 'left' | 'right';
  children: ReactNode;
}

export default function SideCardTail({ targetRef, visible, side = 'auto', children }: SideCardTailProps) {
  const { isMobile } = useViewport();
  const cardRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useLayoutEffect(() => {
    if (isMobile || !visible || !targetRef.current) { setLayout(null); return; }
    const target = targetRef.current.getBoundingClientRect();
    const cardH = cardRef.current?.offsetHeight ?? 180;
    setLayout(computeLayout(target, cardH, window.innerWidth, window.innerHeight, side));
  }, [isMobile, visible, side, targetRef]);

  useEffect(() => {
    if (isMobile || !visible || !targetRef.current) return;
    const recompute = () => {
      const t = targetRef.current?.getBoundingClientRect();
      if (!t) return;
      const cardH = cardRef.current?.offsetHeight ?? 180;
      setLayout(computeLayout(t, cardH, window.innerWidth, window.innerHeight, side));
    };
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    const ro = new ResizeObserver(recompute);
    ro.observe(targetRef.current);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      ro.disconnect();
    };
  }, [isMobile, visible, side, targetRef]);

  if (isMobile || !visible || !layout) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <svg className="absolute inset-0 h-full w-full">
        <polygon
          points={layout.ray.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="rgba(251,246,239,0.95)"
          style={{ transition: 'all 220ms ease' }}
        />
      </svg>
      <div
        ref={cardRef}
        className="pointer-events-auto absolute transition-all duration-[220ms] ease-out"
        style={{
          left: layout.card.left,
          top: layout.card.top,
          width: layout.card.width,
          transform: `translateX(${layout.side === 'left' ? '0' : '0'})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write Storybook story**

Create `frontend/src/components/landing/SideCardTail.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import SideCardTail from './SideCardTail';
import CityCard from '../ui/CityCard';

function Demo({ x, y }: { x: string; y: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#1a3340' }}>
      <div ref={ref} style={{ position: 'absolute', left: x, top: y, width: 16, height: 16, borderRadius: 8, background: '#F4A24C' }} />
      <SideCardTail targetRef={ref} visible>
        <CityCard
          city={{ id: 'madrid', name: 'Madrid', population: 3300000, score: 72 } as never}
        />
      </SideCardTail>
    </div>
  );
}

const meta: Meta<typeof Demo> = { title: 'Responsive/SideCardTail', component: Demo };
export default meta;
type Story = StoryObj<typeof Demo>;

export const LeftSide: Story = { args: { x: '20%', y: '40%' } };
export const RightSide: Story = { args: { x: '80%', y: '50%' } };
export const TopClamped: Story = { args: { x: '30%', y: '2%' } };
```

(If `CityCard` props differ, stub with a minimal div — point of the story is ray geometry, not card fidelity.)

- [ ] **Step 3: Run Storybook visually**

Run: `cd frontend && npm run storybook`
Expected: three stories render; ray always touches the pin and the card's inner edge.

- [ ] **Step 4: Run lint + typecheck**

Run: `cd frontend && npm run lint && npm run typecheck`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/SideCardTail.tsx frontend/src/components/landing/SideCardTail.stories.tsx
git commit -m "Add SideCardTail primitive with auto-side and ray polygon"
```

---

## Task 6: DualPanel primitive

**Files:**
- Create: `frontend/src/components/city/DualPanel.tsx`
- Create: `frontend/src/components/city/DualPanel.stories.tsx`

- [ ] **Step 1: Write DualPanel**

Create `frontend/src/components/city/DualPanel.tsx`:

```tsx
import { type ReactNode, Children, isValidElement } from 'react';
import { useViewport } from '../../hooks/useViewport';

interface SlotProps { children: ReactNode; }
function Left({ children }: SlotProps) { return <>{children}</>; }
function Right({ children }: SlotProps) { return <>{children}</>; }

interface DualPanelProps {
  breakpoint?: 'ultrawide';
  leftRatio?: number;
  children: ReactNode;
}

function DualPanel({ leftRatio = 0.4, children }: DualPanelProps) {
  const { isUltrawide } = useViewport();

  let left: ReactNode = null;
  let right: ReactNode = null;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Left) left = child;
    else if (child.type === Right) right = child;
  });

  if (!isUltrawide) {
    return <>{left}{right}</>;
  }

  return (
    <div
      className="grid gap-[var(--space-gutter)]"
      style={{ gridTemplateColumns: `${leftRatio * 100}% 1fr` }}
    >
      <div className="overflow-y-auto">{left}</div>
      <div>{right}</div>
    </div>
  );
}

DualPanel.Left = Left;
DualPanel.Right = Right;
export default DualPanel;
```

- [ ] **Step 2: Write story**

Create `frontend/src/components/city/DualPanel.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import DualPanel from './DualPanel';

function Demo() {
  return (
    <DualPanel>
      <DualPanel.Left>
        <div style={{ padding: 16, background: '#fbf6ef', height: 600 }}>Left — filters + stats</div>
      </DualPanel.Left>
      <DualPanel.Right>
        <div style={{ padding: 16, background: '#a4b7ca', height: 600 }}>Right — map canvas</div>
      </DualPanel.Right>
    </DualPanel>
  );
}
const meta: Meta<typeof Demo> = { title: 'Responsive/DualPanel', component: Demo };
export default meta;
type Story = StoryObj<typeof Demo>;
export const Default: Story = {};
```

- [ ] **Step 3: Visually verify in Storybook at 375 / 1280 / 2400 px**

Expected: stacked below 1920px; grid at ≥1920px.

- [ ] **Step 4: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/city/DualPanel.tsx frontend/src/components/city/DualPanel.stories.tsx
git commit -m "Add DualPanel primitive for ultrawide two-column layouts"
```

---

## Task 7: MobileTabs primitive

**Files:**
- Create: `frontend/src/components/compare/MobileTabs.tsx`
- Create: `frontend/src/components/compare/MobileTabs.test.tsx`
- Create: `frontend/src/components/compare/MobileTabs.stories.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/compare/MobileTabs.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MobileTabs from './MobileTabs';

function setMobile() {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, // both 768 and 1920 queries -> mobile
    media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true,
  }));
}

describe('MobileTabs', () => {
  beforeEach(() => {
    setMobile();
    window.location.hash = '';
  });

  it('renders only the active tab on mobile', () => {
    render(
      <MobileTabs defaultTab="a">
        <MobileTabs.Tab id="a" label="A">content-a</MobileTabs.Tab>
        <MobileTabs.Tab id="b" label="B">content-b</MobileTabs.Tab>
      </MobileTabs>,
    );
    expect(screen.getByText('content-a')).toBeInTheDocument();
    expect(screen.queryByText('content-b')).not.toBeInTheDocument();
  });

  it('switches tab on click and updates hash', () => {
    render(
      <MobileTabs defaultTab="a">
        <MobileTabs.Tab id="a" label="A">content-a</MobileTabs.Tab>
        <MobileTabs.Tab id="b" label="B">content-b</MobileTabs.Tab>
      </MobileTabs>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('content-b')).toBeInTheDocument();
    expect(window.location.hash).toBe('#tab=b');
  });

  it('reads initial tab from hash', () => {
    window.location.hash = '#tab=b';
    render(
      <MobileTabs defaultTab="a">
        <MobileTabs.Tab id="a" label="A">content-a</MobileTabs.Tab>
        <MobileTabs.Tab id="b" label="B">content-b</MobileTabs.Tab>
      </MobileTabs>,
    );
    expect(screen.getByText('content-b')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/compare/MobileTabs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write MobileTabs**

Create `frontend/src/components/compare/MobileTabs.tsx`:

```tsx
import { type ReactNode, Children, isValidElement, useEffect, useState } from 'react';
import { useViewport } from '../../hooks/useViewport';

interface TabProps { id: string; label: string; children: ReactNode; }
function Tab({ children }: TabProps) { return <>{children}</>; }

interface MobileTabsProps {
  defaultTab: string;
  children: ReactNode;
}

function readHashTab(): string | null {
  const m = typeof window !== 'undefined' ? window.location.hash.match(/#tab=([\w-]+)/) : null;
  return m ? m[1] : null;
}

function MobileTabs({ defaultTab, children }: MobileTabsProps) {
  const { isMobile } = useViewport();
  const [active, setActive] = useState<string>(() => readHashTab() ?? defaultTab);

  useEffect(() => {
    const onHashChange = () => {
      const t = readHashTab();
      if (t) setActive(t);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const tabs: { id: string; label: string; content: ReactNode }[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== Tab) return;
    const { id, label, children: c } = child.props as TabProps;
    tabs.push({ id, label, content: c });
  });

  if (!isMobile) {
    return <>{tabs.map((t) => <div key={t.id}>{t.content}</div>)}</>;
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
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
      <div role="tabpanel">{current.content}</div>
    </div>
  );
}

MobileTabs.Tab = Tab;
export default MobileTabs;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/compare/MobileTabs.test.tsx`
Expected: 3 passed.

- [ ] **Step 5: Write story**

Create `frontend/src/components/compare/MobileTabs.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import MobileTabs from './MobileTabs';

function Demo() {
  return (
    <MobileTabs defaultTab="graphs">
      <MobileTabs.Tab id="graphs" label="Gráficos"><div style={{ padding: 20 }}>Charts</div></MobileTabs.Tab>
      <MobileTabs.Tab id="table" label="Tabla"><div style={{ padding: 20 }}>Table</div></MobileTabs.Tab>
      <MobileTabs.Tab id="detail" label="Detalle"><div style={{ padding: 20 }}>Detail</div></MobileTabs.Tab>
    </MobileTabs>
  );
}
const meta: Meta<typeof Demo> = { title: 'Responsive/MobileTabs', component: Demo };
export default meta;
type Story = StoryObj<typeof Demo>;
export const Default: Story = {};
```

- [ ] **Step 6: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/compare/MobileTabs.tsx frontend/src/components/compare/MobileTabs.test.tsx frontend/src/components/compare/MobileTabs.stories.tsx
git commit -m "Add MobileTabs primitive with URL hash sync"
```

---

## Task 8: ResponsiveChart primitive

**Files:**
- Create: `frontend/src/components/ui/ResponsiveChart.tsx`
- Create: `frontend/src/components/ui/ResponsiveChart.stories.tsx`

- [ ] **Step 1: Write ResponsiveChart**

Create `frontend/src/components/ui/ResponsiveChart.tsx`:

```tsx
import { type ReactNode, useEffect, useRef, useState } from 'react';

export type ChartBand = 'narrow' | 'medium' | 'wide';

function bandFor(width: number): ChartBand {
  if (width < 480) return 'narrow';
  if (width < 960) return 'medium';
  return 'wide';
}

interface RenderArgs { band: ChartBand; width: number; height: number; }

interface ResponsiveChartProps {
  minHeight: number;
  maxHeight: number;
  maxWidth?: number;
  children: (args: RenderArgs) => ReactNode;
}

export default function ResponsiveChart({ minHeight, maxHeight, maxWidth, children }: ResponsiveChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: minHeight });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = Math.min(maxHeight, Math.max(minHeight, Math.round(w * 0.5)));
      setSize({ width: w, height: h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minHeight, maxHeight]);

  return (
    <div
      ref={ref}
      style={{ containerType: 'inline-size', maxWidth, width: '100%', minHeight, height: size.height }}
    >
      {size.width > 0 && children({ band: bandFor(size.width), width: size.width, height: size.height })}
    </div>
  );
}
```

- [ ] **Step 2: Write story**

Create `frontend/src/components/ui/ResponsiveChart.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import ResponsiveChart from './ResponsiveChart';

function Demo() {
  return (
    <ResponsiveChart minHeight={220} maxHeight={340}>
      {({ band, width, height }) => (
        <div style={{ width, height, background: '#eef4f8', padding: 12 }}>
          Band: <b>{band}</b> — {width}×{height}
        </div>
      )}
    </ResponsiveChart>
  );
}
const meta: Meta<typeof Demo> = { title: 'Responsive/ResponsiveChart', component: Demo };
export default meta;
type Story = StoryObj<typeof Demo>;
export const Default: Story = {};
```

- [ ] **Step 3: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/ui/ResponsiveChart.tsx frontend/src/components/ui/ResponsiveChart.stories.tsx
git commit -m "Add ResponsiveChart container-query wrapper"
```

---

## Task 9: HeroSection + GetInvolvedSection

**Files:**
- Modify: `frontend/src/components/landing/HeroSection.tsx`
- Modify: `frontend/src/components/landing/GetInvolvedSection.tsx`

- [ ] **Step 1: HeroSection — replace hard-coded horizontal margins**

Find any `mx-[50px] lg:mx-[100px]` (or similar hard-coded pixel horizontal spacing) and replace with `px-[var(--space-gutter)]`. Replace vertical hard-coded paddings around the hero block with `py-[var(--space-section-y)]` where semantically appropriate.

- [ ] **Step 2: HeroSection — confirm two-column stacks on mobile**

The existing two-column layout (text + glass cards) should already stack with `grid-cols-1 md:grid-cols-2`. If it's using `flex`, add `flex-col md:flex-row`. Leave the 6vw hero title scaling.

- [ ] **Step 3: GetInvolvedSection — cap reading width and stack multi-col**

In `GetInvolvedSection.tsx`, wrap the content container with `max-w-[var(--container-reading)] mx-auto px-[var(--space-gutter)] py-[var(--space-section-y)]`. Any multi-col content inside becomes `grid-cols-1 md:grid-cols-2` (or similar) so it stacks on mobile.

- [ ] **Step 4: Visual check across 375 / 1280 / 2400 px.**

- [ ] **Step 5: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/landing/HeroSection.tsx frontend/src/components/landing/GetInvolvedSection.tsx
git commit -m "Apply layout tokens to HeroSection and GetInvolvedSection"
```

---

## Task 10: WaveBackground quality prop

**Files:**
- Modify: `frontend/src/components/ui/WaveBackground.tsx`

- [ ] **Step 1: Add quality prop**

```tsx
export interface WaveBackgroundProps {
  // …existing props
  quality?: 'low' | 'high';
}

export default function WaveBackground({ quality = 'high', /* …rest */ }: WaveBackgroundProps) {
  const segments = quality === 'low' ? ORIGINAL_SEGMENTS / 2 : ORIGINAL_SEGMENTS;
  const waveHeight = quality === 'low' ? ORIGINAL_WAVE_HEIGHT * 0.75 : ORIGINAL_WAVE_HEIGHT;
  const pixelRatio = quality === 'low' ? 1 : Math.min(window.devicePixelRatio ?? 1, 2);
  // …use these where the existing constants are referenced
}
```

Replace whatever existing constants the renderer uses (`segments`, `waveHeight`, and the `setPixelRatio` call) with the above derived values. Quality change while mounted should reinitialize the renderer — trigger this by keying the Three.js canvas `<div>` on `quality` (React will remount):

```tsx
<div ref={mountRef} key={quality} className="absolute inset-0" />
```

- [ ] **Step 2: Existing callers default to 'high' (verify no signature breakage)**

Run: `cd frontend && npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/WaveBackground.tsx
git commit -m "Add quality prop to WaveBackground for mobile perf"
```

---

## Task 11: SpainMap responsive sizing + pin rendering

**Files:**
- Modify: `frontend/src/components/landing/SpainMap.tsx`

- [ ] **Step 1: Make SpainMap fill its parent**

Remove the `width` / `height` props (or keep them optional as fallbacks). Add a `ResizeObserver` on the root element:

```tsx
const rootRef = useRef<HTMLDivElement>(null);
const [size, setSize] = useState({ width: 900, height: 700 });

useEffect(() => {
  if (!rootRef.current) return;
  const el = rootRef.current;
  const ro = new ResizeObserver(() => {
    setSize({ width: el.clientWidth, height: el.clientHeight });
  });
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

Use `size.width` / `size.height` in the D3 `geoMercator().fitSize([w, h], features)` projection and SVG `viewBox`.

Accept `className` prop; default root sizing to `w-full h-full`.

- [ ] **Step 2: Replace pin markup**

Replace each existing pin with an SVG `<g>` that renders halo + ring + core + label:

```tsx
function Pin({ city, x, y, isActive, isHovered, isMobile, onClick, onHover }: PinProps) {
  const haloR = isMobile ? 10 : 12;
  const ringR = isMobile ? 5  : 6;
  const coreR = isMobile ? 2.5 : 3;
  const scale = isActive ? 1.25 : 1;
  return (
    <g
      transform={`translate(${x},${y})`}
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <circle r={haloR * scale} fill="#F4A24C" opacity={isActive ? 0.3 : isHovered ? 0.25 : 0.15} className="transition-all" />
      <circle r={ringR * scale} fill="none" stroke="#F4A24C" strokeWidth={1.5} />
      <circle r={coreR * scale} fill={isActive ? '#F4A24C' : '#fff'} stroke="#F4A24C" strokeWidth={1.5} />
      {!isMobile && (
        <text
          y={haloR + 12}
          textAnchor="middle"
          style={{
            fontSize: isHovered ? 11 : 10,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            fill: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
            fontWeight: isActive ? 700 : 500,
            transition: 'font-size 160ms',
          }}
        >
          {city.name}
        </text>
      )}
    </g>
  );
}
```

Wire `isMobile` from `useViewport`. Forward the target `ref` (e.g. via `ref={(el) => pinRefs.current[city.id] = el}`) so `MapSelector` can pass it to `SideCardTail`.

- [ ] **Step 3: Visual verification**

Run: `cd frontend && npm run dev`. Check that:
- Map scales to container (try resizing window).
- Labels appear on desktop, hidden on mobile.
- Hover scales the label on desktop; active state highlights correctly.

- [ ] **Step 4: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/landing/SpainMap.tsx
git commit -m "Make SpainMap viewport-responsive with new pin rendering"
```

---

## Task 12: MapSelector rewrite

**Files:**
- Modify: `frontend/src/components/landing/MapSelector.tsx`
- Modify: `frontend/src/components/ui/ScrollableCityCards.tsx` (if touch-swipe is missing)

- [ ] **Step 1: Switch MapSelector on viewport**

```tsx
import { useViewport } from '../../hooks/useViewport';
// …
const { isMobile } = useViewport();

return isMobile ? <MobileLayout /> : <DesktopLayout />;
```

- [ ] **Step 2: Desktop layout — SpainMap + SideCardTail, no carousel**

```tsx
function DesktopLayout() {
  const [selected, setSelected] = useState<City | null>(null);
  const pinRefs = useRef<Record<string, Element | null>>({});
  const activeRef = selected ? { current: pinRefs.current[selected.id] } : { current: null };

  return (
    <section className="relative w-full h-[80vh] px-[var(--space-gutter)] py-[var(--space-section-y)]">
      <WaveBackground quality="high" />
      <div className="relative z-10 h-full">
        <SpainMap
          onPinClick={setSelected}
          onPinHover={() => {}}
          selectedId={selected?.id ?? null}
          registerPinRef={(id, el) => { pinRefs.current[id] = el; }}
        />
      </div>
      <SideCardTail targetRef={activeRef} visible={!!selected}>
        {selected && <CityCard city={selected} />}
      </SideCardTail>
      {!selected && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-4 py-2 text-sm">
          Haz clic en una ciudad para ver detalles
        </div>
      )}
    </section>
  );
}
```

If `SpainMap` doesn't yet expose `registerPinRef` / `selectedId` / `onPinClick` props, add them as part of this task — they are needed for interaction with `SideCardTail`.

Clicking outside the map (document-level click listener gated on `selected !== null`) clears `selected`.

- [ ] **Step 3: Mobile layout — 40vh map + 45vh carousel**

```tsx
function MobileLayout() {
  const [selected, setSelected] = useState<City | null>(cities[0]);
  return (
    <section className="flex flex-col w-full min-h-[85vh]">
      <div className="h-[40vh] w-full">
        <SpainMap onPinClick={setSelected} selectedId={selected?.id ?? null} />
      </div>
      <div className="h-[45vh] w-full">
        <ScrollableCityCards cities={cities} selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
    </section>
  );
}
```

Pass `quality="low"` to `WaveBackground` if it's still being rendered on mobile; otherwise conditionally skip mounting it.

- [ ] **Step 4: Confirm ScrollableCityCards supports touch-swipe**

Open `frontend/src/components/ui/ScrollableCityCards.tsx`. If the container is already `overflow-x-auto` with CSS scroll-snap, touch-swipe works natively — done. If it relies on wheel/keyboard only, add:

```tsx
<div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth" …>
  {cities.map((c) => (
    <div className="snap-center shrink-0" key={c.id}>…</div>
  ))}
</div>
```

Otherwise leave it alone.

- [ ] **Step 5: Manual verification at 375 / 1280 / 2400 px.**

- [ ] **Step 6: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/landing/MapSelector.tsx frontend/src/components/ui/ScrollableCityCards.tsx
git commit -m "Rewrite MapSelector with desktop side-card and mobile split layout"
```

---

## Task 13: OverviewSection gutter

**Files:**
- Modify: `frontend/src/components/city/OverviewSection.tsx`

- [ ] **Step 1: Replace hard-coded margins with gutter token**

Replace `mx-[100px]` (or similar) with `px-[var(--space-gutter)]`. Ensure the stats grid already uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` — if not, add it.

- [ ] **Step 2: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/city/OverviewSection.tsx
git commit -m "Use gutter token in OverviewSection"
```

---

## Task 14: MapFilters horizontal strip on mobile

**Files:**
- Modify: `frontend/src/components/city/MapFilters.tsx`

- [ ] **Step 1: Branch layout on `useViewport`**

```tsx
const { isMobile } = useViewport();

if (isMobile) {
  return (
    <div className="flex gap-2 overflow-x-auto px-[var(--space-gutter)] py-2 bg-black/[0.03] border-b border-black/10">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold whitespace-nowrap ${m.id === active ? 'bg-[#3a6c7f] text-white border-transparent' : 'bg-white border-black/10 text-black/70'}`}
        >
          {m.icon} {m.shortLabel ?? m.label}
        </button>
      ))}
    </div>
  );
}
// existing desktop grid render unchanged
```

If mode items don't already carry a `shortLabel`, add it inline (e.g. 'Tráfico' → 'Tráfico'; 'Estaciones' → 'Est.'; 'Terreno' → 'Ter.'; 'Interacciones' → 'Inter.').

- [ ] **Step 2: Manual verification across viewports.**

- [ ] **Step 3: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/city/MapFilters.tsx
git commit -m "Add mobile horizontal-strip layout to MapFilters"
```

---

## Task 15: CityMap mobile height + MapControls vertical stacking

**Files:**
- Modify: `frontend/src/components/city/CityMap.tsx`
- Modify: `frontend/src/components/city/MapControls.tsx` (verify vertical prop exists; use it)

- [ ] **Step 1: Conditional height on root map container**

In `CityMap.tsx`, find the root wrapper `<div className="… h-screen …">` and switch to:

```tsx
const { isMobile } = useViewport();
<div className={`relative w-full ${isMobile ? 'h-[65vh]' : 'h-screen'}`}>
```

- [ ] **Step 2: Floating header drops MapControls on mobile**

Inside the floating header JSX, branch:

```tsx
<div className="flex items-center justify-between …">
  <span>{cityName} — {modeLabel}</span>
  {!isMobile && <MapControls onZoomIn={…} onZoomOut={…} onReset={…} vertical={false} />}
</div>
```

- [ ] **Step 3: Render vertical MapControls stacked at bottom-right on mobile**

Below the header, when `isMobile`:

```tsx
{isMobile && (
  <div className="absolute bottom-4 right-3 z-10">
    <MapControls vertical onZoomIn={…} onZoomOut={…} onReset={…} />
  </div>
)}
```

If `MapControls.tsx` doesn't currently have a `vertical` prop, add it — the prop flips the flex direction and makes each button a ≥44px square with glass background.

- [ ] **Step 4: Manual verification**

On mobile (375×812): map at ~65vh, page scrolls past it; zoom/reset buttons stacked vertically at bottom-right with large tap targets.

- [ ] **Step 5: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/city/CityMap.tsx frontend/src/components/city/MapControls.tsx
git commit -m "Add mobile height and vertical MapControls to CityMap"
```

---

## Task 16: CityLegend mobile collapsed mode

**Files:**
- Modify: `frontend/src/components/city/map/CityLegend.tsx`

- [ ] **Step 1: Add collapsed mode**

```tsx
import { useViewport } from '../../../hooks/useViewport';
import { useState } from 'react';

export default function CityLegend(/* existing props */) {
  const { isMobile } = useViewport();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    // existing always-visible bottom-left legend
    return /* unchanged */;
  }

  return (
    <div className="absolute bottom-3 left-3 z-10">
      {open && (
        <div className="mb-2 max-h-[40vh] w-[240px] overflow-y-auto rounded-lg bg-white/90 backdrop-blur p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2 text-xs font-bold">
            <span>Leyenda</span>
            <button onClick={() => setOpen(false)} aria-label="Cerrar leyenda">×</button>
          </div>
          {/* existing legend content */}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Mostrar leyenda"
        className="h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center"
      >
        <ListIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
```

`ListIcon` → use `lucide-react`'s `List` or an equivalent already in use in the repo.

Tap-outside-to-close: add a document click listener keyed on `open`, or wrap in a focus trap. Simplest approach: `onBlur` on the popover container with a small delay.

- [ ] **Step 2: Manual verification on mobile.**

- [ ] **Step 3: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/city/map/CityLegend.tsx
git commit -m "Add collapsed mode to CityLegend on mobile"
```

---

## Task 17: MapSection ultrawide DualPanel + CityStats 1-col mobile

**Files:**
- Modify: `frontend/src/components/city/MapSection.tsx`
- Modify: `frontend/src/components/city/CityStats.tsx`

- [ ] **Step 1: Make CityStats grid 1-col on mobile**

Replace the current stats grid class with `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4` (pick the density already used; the key change is `grid-cols-1` on mobile).

- [ ] **Step 2: Wrap MapSection content in DualPanel**

```tsx
import DualPanel from './DualPanel';

<section className="relative w-full">
  <DualPanel>
    <DualPanel.Left>
      <MapFilters …/>
      <CityStats …/>
    </DualPanel.Left>
    <DualPanel.Right>
      <CityMap …/>
    </DualPanel.Right>
  </DualPanel>
</section>
```

Below ultrawide, `DualPanel` renders left then right in order — matching the current vertical flow (`MapFilters` → `CityMap` → `CityStats` is re-ordered to `MapFilters` → `CityStats` → `CityMap`). If preserving the current order matters on mobile/desktop, swap the slots at those tiers by duplicating the markup; otherwise accept the new stacking order.

Decision for this plan: since the spec says stats below the map on mobile and desktop, keep `MapFilters` + `CityMap` + `CityStats` as siblings below ultrawide, and only group into `DualPanel` at ultrawide. Concretely:

```tsx
const { isUltrawide } = useViewport();

if (!isUltrawide) {
  return (
    <section className="relative w-full">
      <MapFilters …/>
      <CityMap …/>
      <CityStats …/>
    </section>
  );
}

return (
  <section className="relative w-full">
    <DualPanel>
      <DualPanel.Left>
        <MapFilters …/>
        <CityStats …/>
      </DualPanel.Left>
      <DualPanel.Right>
        <CityMap …/>
      </DualPanel.Right>
    </DualPanel>
  </section>
);
```

- [ ] **Step 3: Manual verification at 375 / 1280 / 2400 px.**

- [ ] **Step 4: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/components/city/MapSection.tsx frontend/src/components/city/CityStats.tsx
git commit -m "Add ultrawide DualPanel layout and mobile stats stacking to MapSection"
```

---

## Task 18: ComparePage MobileTabs + CityCompareTable mobile-card

**Files:**
- Modify: `frontend/src/pages/ComparePage.tsx`
- Modify: `frontend/src/components/compare/CityCompareTable.tsx`

- [ ] **Step 1: Wrap compare sections in MobileTabs**

In `ComparePage.tsx`:

```tsx
import MobileTabs from '../components/compare/MobileTabs';

<main className="px-[var(--space-gutter)] py-[var(--space-section-y)]">
  <HeroBlock />
  <MobileTabs defaultTab="graphs">
    <MobileTabs.Tab id="graphs" label="Gráficos">
      <ChartsGrid /> {/* existing charts; will be upgraded to ResponsiveChart later */}
    </MobileTabs.Tab>
    <MobileTabs.Tab id="table" label="Tabla">
      <CityCompareTable …/>
    </MobileTabs.Tab>
    <MobileTabs.Tab id="detail" label="Detalle">
      <DetailCards …/>
    </MobileTabs.Tab>
  </MobileTabs>
</main>
```

Because `MobileTabs` passes through all children inline on desktop, the current ComparePage layout is preserved at ≥768px.

- [ ] **Step 2: Ultrawide — widen data sections, cap hero**

In `ComparePage.tsx`, wrap the hero in `max-w-[var(--container-reading)] mx-auto` and the `MobileTabs` block in `max-w-[var(--container-max)] 3xl:max-w-none mx-auto` so the table / detail cards fill the viewport at ultrawide while the hero stays readable. Detail cards container uses `grid-cols-1 md:grid-cols-2 3xl:grid-cols-3 gap-4`.

- [ ] **Step 3: Add mobile-card variant to CityCompareTable**

Inside `CityCompareTable.tsx`:

```tsx
const { isMobile } = useViewport();

if (isMobile) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((city) => (
        <div key={city.id} className="rounded-lg border border-black/10 p-3 bg-white">
          <div className="font-semibold mb-2">{city.name}</div>
          <div className="flex gap-2 overflow-x-auto">
            {stats.map((s) => (
              <div key={s.key} className="shrink-0 rounded bg-[#fbf6ef] px-3 py-2 text-xs">
                <div className="opacity-60">{s.label}</div>
                <div className="font-bold">{formatStat(city, s)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
// existing desktop table render
```

`rows`, `stats`, `formatStat` match whatever the existing desktop table uses — reuse them directly, do not duplicate data-shaping logic.

- [ ] **Step 4: Manual verification on mobile, desktop, ultrawide.**

- [ ] **Step 5: Commit**

```bash
cd frontend && npm run lint && npm run typecheck
git add frontend/src/pages/ComparePage.tsx frontend/src/components/compare/CityCompareTable.tsx
git commit -m "Add MobileTabs wrapping and mobile-card table to ComparePage"
```

---

## Task 19: Playwright responsive tests

**Files:**
- Create: `frontend/src/tests/responsive.spec.ts`
- Modify: `frontend/playwright.config.ts` (if viewport projects need adding)

- [ ] **Step 1: Verify Playwright config has mobile/desktop/ultrawide projects**

Open `frontend/playwright.config.ts`. If not already present, add three projects:

```ts
projects: [
  { name: 'mobile',    use: { viewport: { width: 375,  height: 812  } } },
  { name: 'desktop',   use: { viewport: { width: 1280, height: 800  } } },
  { name: 'ultrawide', use: { viewport: { width: 2400, height: 1200 } } },
],
```

- [ ] **Step 2: Write responsive tests**

Create `frontend/src/tests/responsive.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('mobile navbar', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('burger expands and reveals links + cities submenu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /menu|burger|☰/i }).click();
    await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await page.getByRole('button', { name: /Ciudades/i }).click();
    await expect(page.getByRole('link', { name: 'Madrid' })).toBeVisible();
  });
});

test.describe('mobile landing', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('spain map and carousel both visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg').first()).toBeVisible();
    await expect(page.getByText('Madrid').first()).toBeVisible();
  });
});

test.describe('mobile city page', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('map is 65vh and legend toggles', async ({ page }) => {
    await page.goto('/ciudad/madrid');
    const map = page.locator('[data-testid="city-map"], .maplibregl-map').first();
    await expect(map).toBeVisible();
    await page.getByRole('button', { name: /Mostrar leyenda/i }).click();
    await expect(page.getByText('Leyenda')).toBeVisible();
  });
});

test.describe('mobile compare tabs', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('tabs switch content', async ({ page }) => {
    await page.goto('/comparar');
    await page.getByRole('tab', { name: 'Tabla' }).click();
    await expect(page).toHaveURL(/#tab=table/);
  });
});

test.describe('desktop landing', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('pin click shows side card with ray', async ({ page }) => {
    await page.goto('/');
    await page.locator('circle[r="6"]').first().click();
    await expect(page.getByRole('region', { name: /Madrid|Barcelona|Valencia|Sevilla/i })).toBeVisible();
  });
});

test.describe('ultrawide city page', () => {
  test.use({ viewport: { width: 2400, height: 1200 } });
  test('dual panel places stats and map side by side', async ({ page }) => {
    await page.goto('/ciudad/madrid');
    // Verify layout by checking the grid column template on the dual-panel wrapper:
    const panel = page.locator('[data-testid="dual-panel"], section').first();
    const cols = await panel.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(' ').length).toBeGreaterThanOrEqual(2);
  });
});
```

Tag any selectors that don't obviously resolve (e.g. the dual-panel wrapper) with `data-testid` on the relevant component, and update the test to match.

- [ ] **Step 3: Run Playwright**

Run: `cd frontend && npx playwright test src/tests/responsive.spec.ts`
Expected: all tests pass. Fix selector / behavior mismatches as they surface.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/tests/responsive.spec.ts frontend/playwright.config.ts
git commit -m "Add Playwright responsive tests across mobile, desktop, ultrawide"
```

---

## Final: Push and open PR

- [ ] **Step 1: Verify full suite**

```bash
cd frontend && npm run lint && npm run typecheck && npx vitest run && npx playwright test
```

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/responsive
```

- [ ] **Step 3: Open PR with summary linking the spec**

Summary bullet points:
- Three-tier responsive design (mobile / desktop / ultrawide)
- New hook `useViewport` and four primitives (`SideCardTail`, `DualPanel`, `MobileTabs`, `ResponsiveChart`)
- Landing, city, compare, about, 404 pages responsive; StatusPage intentionally skipped
- Design doc: `docs/superpowers/specs/2026-04-18-responsive-design-design.md`

---

## Notes for the Implementer

- **Do not create new directories** like `components/responsive/`. Primitives live next to their consumers.
- **Do not modify StatusPage** in this plan. It is explicitly out of scope.
- **Chart library selection is out of scope.** `<ResponsiveChart>` is a wrapper that exposes a band; charts themselves are future work. If the compare "Gráficos" tab currently has bar-chart markup using raw SVG / divs, wrap those blocks in `<ResponsiveChart>` but do NOT rewrite them with a new charting library.
- **Follow existing import and styling conventions** (Tailwind utilities, CSS variables in `theme.css`, no CSS modules).
- **When in doubt, read the spec section referenced next to each task** — especially for SpainMap pin visuals (§6.1) and SideCardTail geometry (§6.2).
