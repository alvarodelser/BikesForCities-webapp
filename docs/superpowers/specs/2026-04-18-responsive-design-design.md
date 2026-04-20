# Responsive Design — Frontend Extension (Design)

**Date:** 2026-04-18
**Status:** Design approved, ready for implementation plan
**Scope:** Extend responsive behavior across the whole frontend (landing, city, compare, about, 404, navbar, footer) with explicit treatment for mobile, desktop, and ultrawide viewports. StatusPage is explicitly out of scope.

---

## 1. Breakpoints

Three tiers only:

| Tier       | Range      | Tailwind key |
|------------|------------|--------------|
| `mobile`   | `< 768px`  | default (no prefix) |
| `desktop`  | `≥ 768px`  | `md:` |
| `ultrawide`| `≥ 1920px` | `3xl:` (custom) |

`sm:`, `lg:`, `xl:`, `2xl:` are not authored for new code. They still compile (Tailwind defaults) but the team agrees on a single intermediate breakpoint. Tailwind 4 `@theme` block gets `--breakpoint-3xl: 1920px;`.

---

## 2. Layout tokens

Added to `src/styles/theme.css`:

```css
--container-reading: 72ch;              /* hero prose, About copy */
--container-data:    100%;              /* maps, charts, tables — fill available */
--container-max:     1440px;            /* outer cap for reading content */
--space-section-y:   clamp(2rem, 4vw, 5rem);
--space-gutter:      clamp(1rem, 4vw, 6rem);
```

These replace hard-coded pixels like `mx-[50px] lg:mx-[100px]`, `mx-[100px]`, and `mx-[120px]` scattered across `HeroSection`, `OverviewSection`, `MapFilters`.

---

## 3. Viewport hook

`src/hooks/useViewport.ts`:

```ts
type ViewportTier = 'mobile' | 'desktop' | 'ultrawide';

function useViewport(): {
  tier: ViewportTier;
  isMobile: boolean;
  isDesktop: boolean;
  isUltrawide: boolean;
};
```

- Backed by `window.matchMedia` with two queries (`(min-width: 768px)`, `(min-width: 1920px)`).
- SSR-safe stub returns `'desktop'` when `window` is undefined (avoids hydration flashes on desktop-majority initial loads).
- Subscribes on mount, unsubscribes on unmount.

CSS-only responsive behavior is preferred wherever possible. `useViewport` is used only for behavior CSS cannot express (drag gestures, render-quality switches, structural layout swaps).

---

## 4. Responsive primitives

### 4.1 Navbar (mobile branch — folded into existing `components/layout/Navbar.tsx`)

Mobile (`< 768px`):

- Centered floating pill, matching the existing desktop `scrolled` aesthetic. Logo left, burger icon right.
- Tapping burger expands the pill *downward* using the same `max-h` transition already present for the city dropdown. Expanded content is a vertical stack: `Inicio`, `Ciudades ▾`, `Compara`, `Acerca de`.
- Tapping `Ciudades ▾` within the expanded pill expands it further downward, revealing an indented list of all cities (reusing the same styling as the desktop `ScrollableCityList` items). A nested scroll container handles long lists.
- Tap targets ≥ 44px on primary links; city sublinks slightly smaller.
- Both scrolled and non-scrolled Navbar states support the downward expansion.

Desktop (`≥ 768px`): unchanged from current behavior.

Ultrawide (`≥ 1920px`): unchanged — pill remains centered and capped at its existing max-width.

### 4.2 `<SideCardTail>` (`components/landing/SideCardTail.tsx`)

```tsx
<SideCardTail targetRef={pinRef} side="auto" visible={!!selectedCity}>
  <CityCard city={selected} />
</SideCardTail>
```

- Desktop-only; on mobile it returns `null` (caller is responsible for not mounting it on mobile).
- `side="auto"`: if target center-X is in the viewport's left half, card renders on the left (closest side); else right.
- Card position: vertically centered on target, clamped 16px from top/bottom.
- Ray: an SVG `<polygon>` in an absolutely positioned SVG layer drawn beneath the card. Three points: target center + two points on the card's inner edge spanning a 40px vertical band centered on target Y. Fill: `rgba(251,246,239,0.95)` (matches card background).
- Recomputes on window `resize` and `scroll`, and whenever `targetRef` reports a new rect (via `ResizeObserver`).
- Entrance: card fades in and slides 8px from target side over 220ms; ray's polygon `points` are animated via CSS `transition`.

### 4.3 `<DualPanel>` (`components/city/DualPanel.tsx`)

```tsx
<DualPanel breakpoint="ultrawide" leftRatio={0.4}>
  <DualPanel.Left>{filters + stats}</DualPanel.Left>
  <DualPanel.Right>{map canvas}</DualPanel.Right>
</DualPanel>
```

- Activates only at `≥ 1920px`. Below that, renders `Left` then `Right` stacked in flow order (identity pass-through).
- Ultrawide: `display: grid; grid-template-columns: ${leftRatio*100}% 1fr; gap: var(--space-gutter);`
- Left column is vertically scrollable when content overflows; right column fills the row height.

### 4.4 `<MobileTabs>` (`components/compare/MobileTabs.tsx`)

```tsx
<MobileTabs defaultTab="graphs">
  <MobileTabs.Tab id="graphs" label="Gráficos">…</MobileTabs.Tab>
  <MobileTabs.Tab id="table"  label="Tabla">…</MobileTabs.Tab>
  <MobileTabs.Tab id="detail" label="Detalle">…</MobileTabs.Tab>
</MobileTabs>
```

- Mobile: renders a horizontal tab bar at top; only the active tab's children mount.
- Desktop/ultrawide: renders all children inline (stacked sections), ignoring tabs — identical to the current ComparePage flow.
- URL hash (`#tab=table`) syncs state so the browser back button works as expected on mobile.

### 4.5 `<ResponsiveChart>` (`components/ui/ResponsiveChart.tsx`)

```tsx
<ResponsiveChart minHeight={200} maxHeight={400}>
  {({ band, width, height }) => <BarChart band={band} width={width} height={height} …/>}
</ResponsiveChart>
```

- Uses CSS container queries (`container-type: inline-size`) to detect its own rendered width.
- Exposes a band via render-prop: `narrow` (<480px), `medium` (480–960px), `wide` (≥960px).
- No specific chart library is chosen in this spec. When a library is picked (future work), chart components consume the `band` to adapt labels, legend position, tick density, and tooltip behavior.

### 4.6 Primitive file placement (final)

| Primitive             | File                                             |
|-----------------------|--------------------------------------------------|
| `useViewport` hook    | `src/hooks/useViewport.ts`                       |
| Mobile navbar branch  | `src/components/layout/Navbar.tsx` (in place)    |
| `SideCardTail`        | `src/components/landing/SideCardTail.tsx`        |
| `DualPanel`           | `src/components/city/DualPanel.tsx`              |
| `MobileTabs`          | `src/components/compare/MobileTabs.tsx`          |
| `ResponsiveChart`     | `src/components/ui/ResponsiveChart.tsx`          |

No `components/responsive/` directory is created — primitives live near their consumers.

---

## 5. Page-by-page responsive behavior

### 5.1 Navbar (`components/layout/Navbar.tsx`)

See §4.1. Desktop/ultrawide unchanged; mobile gets centered pill with downward-expanding menu and nested cities submenu.

### 5.2 Footer (`components/layout/Footer.tsx`)

- Mobile: 3-column grid becomes 1-column stack. Social icons stay horizontal. Copyright pill wraps when needed.
- Desktop/ultrawide: content capped at `var(--container-max)` centered.

### 5.3 LandingPage (`pages/LandingPage.tsx`)

**HeroSection:**
- Replace `mx-[50px] lg:mx-[100px]` with `var(--space-gutter)`.
- Two-column layout (text + glass cards) stacks 1-column on mobile.
- Existing `6vw` title scaling kept as-is.

**MapSelector (rewrite):**
- **Mobile**: Spain map at ~40vh at top, swipeable city carousel at ~45vh below. Both visible without scrolling. Existing `ScrollableCityCards` gains touch-swipe handlers.
- **Desktop**: Spain map fills the section (no carousel); pins render halo+ring+dot with minimalist uppercase labels below (see §6). Clicking a pin mounts `<SideCardTail>` on the closest side with triangular ray. Default (nothing selected): empty side + hint pill "Haz clic en una ciudad para ver detalles". Hover → halo pulses + label grows slightly.
- **Ultrawide**: same layout as desktop; map area fills the viewport's remaining width.

**WaveBackground**: accepts `quality: 'low' | 'high'`. `MapSelector` passes `useViewport().isMobile ? 'low' : 'high'`. See §6.

**GetInvolvedSection:** content capped at `var(--container-reading)`; multi-column content stacks on mobile.

### 5.4 CityPage (`pages/CityPage.tsx`)

**OverviewSection:**
- Replace hard-coded gutter with `var(--space-gutter)`. Stats grid keeps existing `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` responsiveness.

**MapSection:**

- **Mobile**:
  - `MapFilters` converts to a horizontal-scroll strip of chips (mode icon + short label). Active mode is highlighted.
  - `CityMap` renders at fixed `h-[65vh]` (not `h-screen`), so the page around it remains vertically scrollable.
  - `MapControls` (zoom / layers / reset): vertical stack at bottom-right of the map; each button ≥ 44×44px. Moved out of the floating header for space. Uses the existing `vertical` prop in `MapControls.tsx`.
  - Floating header keeps city name + mode; control row removed on mobile.
  - `CityLegend`: becomes a small circular icon button (~36px) at bottom-left of the map; tap opens a compact glass popover anchored above the button. Popover never exceeds ~40% of map height. Close via ×, tap outside, or re-tap the icon. Legend contents themselves are unchanged.
  - `CityStats`: renders below the map as normal scroll content; stats grid 1-column on mobile.

- **Desktop**: unchanged from current behavior. Filters grid, full-height map, controls inline in floating header, legend at bottom-left always visible, stats below.

- **Ultrawide**: `MapSection` wraps its children in `<DualPanel>`. Left (40%): `MapFilters` + `CityStats` stacked vertically, scrollable. Right (60%): floating header + MapLibre canvas + legend + controls fill the right panel's height. `OverviewSection` is *not* dual-paneled — stays above as a normal section.

### 5.5 ComparePage (`pages/ComparePage.tsx`)

- **Mobile**: hero stays on top; the three sections (charts / table / detail cards) are wrapped in `<MobileTabs>` (`Gráficos`, `Tabla`, `Detalle`). Charts use `<ResponsiveChart>` and render 1-col stacked inside the Gráficos tab. `CityCompareTable` gets a mobile-card variant: each city becomes a card with horizontally scrolling stat chips. Detail cards stack 1-col.

- **Desktop**: unchanged — all sections rendered inline, no tabs.

- **Ultrawide**: data sections (table, detail cards) raise their max-width so they fill the screen; hero block capped at `var(--container-reading)`.

### 5.6 AboutPage (`pages/AboutPage.tsx`)

- Text-heavy reading page. Content capped at `var(--container-reading)` (~72ch) across all viewports.
- Mobile stacks any multi-col content; otherwise unchanged.

### 5.7 NotFoundPage (`pages/NotFoundPage.tsx`)

- Apply `var(--space-gutter)` and `var(--space-section-y)`. Ensure it fills viewport and centers on all tiers. No structural changes.

### 5.8 StatusPage (`pages/StatusPage.tsx`)

**Out of scope.** Leave as-is.

---

## 6. Maps in depth

### 6.1 SpainMap — `components/landing/SpainMap.tsx`

**Sizing:**
- Remove prop-driven `width` / `height`. Replace with an internal `ResizeObserver` on the component's root element; D3 `geoMercator` re-projects on size change.
- External API becomes `className`-driven.

**Pin rendering (SVG `<g>` per pin):**

| Layer     | Desktop radius | Mobile radius | Style                                                                 |
|-----------|----------------|---------------|-----------------------------------------------------------------------|
| Halo      | 12             | 10            | Fill `#F4A24C` @ 15% opacity. Pulses via CSS `@keyframes` on hover.   |
| Ring      | 6              | 5             | Stroke `#F4A24C` @ 1.5px, no fill.                                    |
| Core      | 3              | 2.5           | Fill `#fff`, stroke `#F4A24C` @ 1.5px.                                |
| Label     | 10px uppercase | — (hidden)    | `text-anchor: middle`, `letter-spacing: 0.5px`, `fill: rgba(255,255,255,0.85)`. |

**States:**
- Default: as above.
- Hover (desktop): halo opacity pulses, label font-size grows +10%.
- Active: core fills orange, all radii +25%, halo opacity up, label bold and pure white.

**Interaction:**
- Mobile: tap a pin → select city + advance carousel; tap target is the full halo radius for forgiveness.
- Desktop: click → activate + mount `<SideCardTail>` with `<CityCard>` for that city. Click outside → deselect and unmount.

### 6.2 SideCardTail geometry

- Placement: `side="auto"` picks the side where the target's center-X sits (closest side to the pin).
- Vertical: card top = target center-Y − card height / 2, clamped to 16px from viewport top/bottom.
- Ray polygon: `[targetCenter, cardEdge_top, cardEdge_bottom]` where `cardEdge_top` and `cardEdge_bottom` are 20px above and below the card's vertical center, on the card's inner edge.
- All SVG coordinates are in viewport space; the `SideCardTail` component uses `position: fixed` and reads `getBoundingClientRect()` on the target and on itself.
- Updates on window `resize`, window `scroll`, and any size change of the target (observed).

### 6.3 CityMap — `components/city/CityMap.tsx` (+ inner shells)

**Heights:**
- Mobile: `h-[65vh]` replaces `h-screen` — leaves the outer page scrollable.
- Desktop: `h-screen` unchanged.
- Ultrawide: inside `<DualPanel.Right>`, height is computed to fill the panel row.

**Floating header:**
- Mobile: retain city name + mode; remove the inline `<MapControls>`; shrink padding.
- Desktop/ultrawide: unchanged.

**CityLegend:**
- Desktop/ultrawide: always visible, bottom-left of the map (current behavior).
- Mobile: a new `collapsed` mode. Renders as a ~36px circular glass icon-button (icon: `Lucide List` or equivalent) at bottom-left of the map. Tap opens a glass popover anchored above the button with the existing legend content. Popover height ≤ 40% of map height; internally scrollable if needed. Close by re-tapping the icon, tapping outside, or the × in the popover.

**MapControls:**
- Desktop/ultrawide: inline horizontal inside the floating header (current).
- Mobile: `vertical` prop set to true; positioned bottom-right of the map; each button ≥ 44×44px for touch.

### 6.4 WaveBackground — `components/ui/WaveBackground.tsx`

- Add `quality: 'low' | 'high'` prop (default `'high'`, maintaining current behavior for existing callers).
- Low quality: halves `segments`; slightly lower `waveHeight`; `devicePixelRatio` clamped to 1 (not auto).
- `MapSelector` passes quality based on `useViewport().isMobile`. Mid-session quality change (e.g., device rotation across the breakpoint) triggers a renderer reinitialization — rare but handled.

---

## 7. Plots

Charts are not yet implemented. This section sets the rules any future chart work must follow.

**`<ResponsiveChart>`** — see §4.5. Wraps any chart with a container-query-aware band detector.

**Band-driven chart behavior (required):**

| Aspect     | `narrow` (<480px)       | `medium` (480–960px) | `wide` (≥960px)    |
|------------|-------------------------|----------------------|--------------------|
| Labels     | Abbreviated (`short`)   | Full                 | Full               |
| Legend     | Hidden, fold into tooltips | Below chart       | Right of chart     |
| Tooltips   | Tap                     | Hover                | Hover              |
| Axis ticks | Every 3rd or key points | Every 2nd            | Every              |

**Chart library decision is deferred.** When picked (likely Recharts, Visx, or raw D3), chart components must:

1. Be a single implementation per metric (no separate mobile/desktop components).
2. Accept `{ band, data, minHeight, maxHeight }` from the `ResponsiveChart` render-prop.
3. Derive width/height from the container — no hardcoded dimensions.
4. Support both pointer and touch interactions.

**Per-page chart layout:**

- **ComparePage**: two initial charts ("Red ciclista", "Cobertura"). Desktop 2-column grid; mobile stacked inside the Gráficos tab. Each chart wrapped in its own `<ResponsiveChart>`. Heights: min 220, max 340.
- **CityStats** (city page): future per-mode charts (traffic intensity by day-of-week, etc.). Same wrapper pattern. Heights: min 180, max 300.
- **Ultrawide**: charts render at `wide` band. Cap individual chart width via a `maxWidth` prop on the wrapper to avoid sparse plots at 2500px+.

---

## 8. Rollout / migration order

Each step is individually shippable — the app is not broken between steps.

| Step | Scope                                                                                  | Risk                       |
|------|----------------------------------------------------------------------------------------|----------------------------|
| 1    | Add breakpoint + layout tokens to `theme.css`; create `hooks/useViewport.ts`.          | Zero — no consumers yet.   |
| 2    | Navbar mobile branch (centered downward-expanding pill, nested cities).                | Isolated to `Navbar.tsx`.  |
| 3    | Footer responsive cols; AboutPage container caps; NotFoundPage gutter/spacing.         | Trivial.                   |
| 4    | Scaffold primitives as no-op pass-throughs: `SideCardTail`, `DualPanel`, `MobileTabs`, `ResponsiveChart`. Storybook stories for each. | Zero — unconsumed. |
| 5    | LandingPage: HeroSection retrofit; SpainMap viewport-responsive + new pin rendering; MapSelector desktop rewrite (no carousel, SideCardTail + ray) and mobile layout (40/45 split); WaveBackground quality prop. | Largest PR — ship alone. |
| 6    | CityPage: OverviewSection retrofit; MapFilters horizontal strip on mobile; CityMap heights + legend toggle + MapControls stacking; DualPanel wrapping for ultrawide. | Significant.               |
| 7    | ComparePage: hero retrofit; MobileTabs wrapping three sections; CityCompareTable mobile-card variant; detail cards responsive. | Moderate.                  |
| 8    | Storybook stories and Playwright viewport tests for all new behavior; fix test fallout. | Low.                       |

**Explicitly out of scope:**
- StatusPage.
- Chart library selection and chart implementation — this spec sets rules; actual charts are future work.
- Dark mode, theme switcher, i18n.
- Backend/API changes.
- Refactoring existing desktop behavior where the output won't change.

---

## 9. Testing strategy

**Storybook** (`*.stories.tsx`): one story file per new primitive, each rendered at 375 / 1280 / 2400px viewports. Covers default, active/expanded, and edge-case states.

**Unit tests (Vitest):**
- `useViewport`: mocked `matchMedia`; assert tier transitions at 768px and 1920px.
- `SideCardTail` placement: stubbed `getBoundingClientRect` at various target positions; assert `side` resolution.
- `MobileTabs` URL hash sync: assert `#tab=…` and active-tab stay in lockstep.

**Playwright (`frontend/src/tests/responsive.spec.ts`):**

- Mobile (375×812):
  - Navbar burger expands, reveals 4 links, nested cities submenu shows ≥ 1 city.
  - Landing carousel is swipeable; Spain map visible above.
  - City page: map fills ~65vh; legend icon toggles popover; MapControls stacked vertically.
  - Compare tabs switch content.

- Desktop (1280×800):
  - Landing pin click → side card with ray appears; outside click dismisses.
  - City page: map `h-screen`; legend always visible.
  - Compare: all sections inline, no tabs.

- Ultrawide (2400×1200):
  - City page: filters + stats in left panel; map fills right panel.
  - Reading-heavy sections cap at `var(--container-max)`.

**Manual smoke testing:** real iPhone and iPad devices before merging Steps 5 and 6.

**Non-goals:**
- Pixel-perfect visual regression (Chromatic etc.).
- A11y audit beyond existing Storybook a11y addon defaults.
