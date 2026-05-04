# CityStats Refactor — Design Spec

**Date:** 2026-04-29
**Status:** Implementation complete — branch `feature/citymap-refactor` (2026-05-03)
**Suggested final location:** `docs/superpowers/specs/2026-04-29-citystats-refactor-design.md`

---

## Context

The `CityStats` component is currently monolithic — it renders stat tiles, traffic computation pills, and static insights/recommendations for all four modes in a single file with no charts, no contextual explanations, and no per-mode structure. Two map layers are also broken:
- `AccidentsLayer` exists with full implementation but is not registered in the MODES registry, so accidents mode renders nothing on the map.
- `InfrastructureLayer` is a 12-line stub — it only toggles `bike-paths-layer` visibility and does not visualize connected components.

This refactor:
1. Decomposes `CityStats` into per-mode panels behind a thin router.
2. Introduces reusable chart primitives (Recharts) and a uniform pill-based stat layout.
3. Adds analytics charts per mode (histograms, comparisons, line charts).
4. Adds a layered help system: stats use inline ❓-flip pills; the map gets a floating help panel anchored to map controls, with deep-links into the side panel via a glow animation.
5. Adds a custom score per mode (donut + city ranking table), embedded in the cities API payload.
6. Reworks the desktop hero to expose mode score badges instead of duplicate km/coverage stats.
7. Fixes the AccidentsLayer registration and the InfrastructureLayer stub.
8. Adds a shared cream-background "Contexto político y presupuestario" section below every mode panel.

Mockup scope is **desktop standard layout only** (single column, stats below map). Mobile sheet and ultrawide DualPanel will follow existing conventions.

---

## Locked architectural decisions

| # | Decision |
|---|----------|
| 1 | **Score data source**: backend embeds `mode_scores: { infrastructure, traffic, stations }` in each city object in `GET /cities` and `GET /cities/{id}`. No separate scores endpoint. Frontend reads directly from city payload. |
| 2 | **Hero composition**: keeps Population + Budget. Drops km network and Coverage. Adds 3 score badges (Infra, Traffic, Stations) as small radial-progress cards. Accidents intentionally excluded — no comparable rank score. |
| 3 | **Per-mode panels own all mode-specific stats** — no tile duplication with hero. |
| 4 | **Stats hooks**: split `useLiveStats` into `useInfraStats`, `useTrafficStats`, `useStationsStats`, `useAccidentsStats`. Each panel owns its own fetch. |
| 5 | **Traffic periods**: add `available_periods: List[str]` to existing `TrafficResponse` (no new endpoint). |
| 6 | **No theme prop** — per-mode panels render with white text on the mode-tinted background. Hero stays cream/light. |
| 7 | **Pill pattern**: a "main" pill spans column width; sub-pills sit directly below, splitting the parent's width N-ways with std gap. All pills same height; only width differs. Each pill carries its own ❓ that flips its content with an explanation. |
| 8 | **Map help system**: floating panel anchored to map controls (desktop standard + mobile); ultrawide instead scrolls the side panel to the relevant `HelpAnchor` and applies a 1.5s glow animation. Specific legend items (e.g. GCC label) deep-link into the same anchor. |
| 9 | **General context section** (mayors + budget) renders in cream below the per-mode panel — shared across modes. |
| 10 | **Stats help vs map help are separate concerns**: stats help = inline ❓-flip on pills/charts. Map help = floating panel / glow-anchor. They do not share components. |

---

## Hero rework

`MapDesktop`'s existing `CityHero` is updated:

```
[on cream]
┌────────────────────────────────────────────────────────────────────────┐
│ ANÁLISIS DE MOVILIDAD CICLISTA                                         │
│                                                                        │
│ Madrid                                                                 │
│ (Comunidad de Madrid)                                                  │
│                                                                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ 👥       │ │ 💶       │ │ ◐ 72     │ │ ◐ 58     │ │ ◐ 81     │       │
│ │ 3.3 M    │ │ 5.4 B €  │ │ Infra    │ │ Tráfico  │ │ Estaciones│       │
│ │Población │ │Presupuest│ │ score    │ │ score    │ │ score    │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ~~~~~~~~~~~~~~~~~~~ wave divider ~~~~~~~~~~~~~~~~~~~~~~~~~~~          │
└────────────────────────────────────────────────────────────────────────┘
```

- Each score badge: small radial-progress ring (mode accent color) at top-left, score (0-100) in big text, label below.
- Score badges are clickable → switches the URL `mode` param to that mode (deep-link).
- If a city lacks a mode (e.g. no stations), that badge hides — hero adapts from 5 → 4 cards.
- Wave-divider color = current mode's accent (existing behavior preserved).

---

## Per-mode panel specs

### Common structure

Every mode panel renders on its mode-tinted background with white text and follows this top-to-bottom flow:
1. Title + subtitle
2. (Stations only) Service name pill
3. (Traffic only) Selection pills (period / generation / routing)
4. **Main pills row**: 1-2 main pills in 2-col grid
5. **Sub-pills row(s)**: each main's sub-pills sit directly under, splitting that column N-ways
6. Charts (one or more, each in its own `GlassCard` with ❓ flip on the container)
7. Score donut + city rank table side-by-side (skipped for accidents)
8. Cream "Contexto político y presupuestario" section appears below in MapDesktop layout, OUTSIDE the panel — shared across all modes

### 1. Infrastructure — `InfraStats.tsx`

**Pills:**
- Main: **Total red** `612.3 km` → subs: `18.9 km / 100k hab.`, `1.4 km / M€ vías pub.`
- Main: **Cobertura total** `38.2 %` → sub: `GCC 24.1 %`

**Charts:**
- `BuildingsDensityHistogram` — x: edificios/km bins (0-5, 5-10, 10-15, …, 30+). y: km de carril en ese bin. Computed client-side from `fetchBuildingCoverageComponents()` GeoJSON. Accent: `var(--blue)`.

**Score donut segments:**
- 50 % Cobertura GCC (`gcc_fraction` from InfraStats)
- 25 % Cobertura total (`city.coverage`)
- 25 % km / 100k hab (normalized vs city set)

### 2. Traffic — `TrafficStats.tsx`

**Selection pills row** (top of panel, above stat pills):
- Período: ene / feb / mar / abr (computed from `available_periods` field)
- Generación: GPS real / Estaciones / Población
- Enrutamiento: Map-matched / Ruta corta / Ruta segura

**Pills:**
- Main: **Viajes / mes** `1.8 M` → sub: `545 / 1000 hab.`
- Main: **Sobre infraestructura** `42.3 %` → sub: `Mediana 156 v/tramo`

**Charts:**
- `RouteLengthHistogram` — distribution of route lengths in km, from `fetchRouteHistogram`.
- `RouteInfraFractionHistogram` — distribution of % of each route on infra, with vertical reference line at city mean (from `fetchTrafficInfraCoverage`).
- `LineAreaChart` for monthly trips evolution — uses new `available_periods` data from traffic response.

**Score donut segments:**
- 40 % cobertura infra (km on infra / total km)
- 30 % viajes / 1000 hab. (normalized)
- 30 % eficiencia ruta (median trip length, normalized inverted)

### 3. Stations — `StationsStats.tsx`

**Service name pill** at top of panel: rounded green badge with `MapPin` icon and `city.service_name` (e.g. "BiciMAD").

**Pills:**
- Main: **Bicicletas totales** `3,450` → subs: `0.95 / 1000 hab.`, `1.2 trips / bici / día`
- Main: **Estaciones activas** `264` → subs: `72 % edif. cubiertos`, `120 m alcance medio`, `38 min / día parada`

**Charts:**
- `StationMonthlyChart` — line/area chart, dual series (estimated/real trips), secondary axis (active stations). From `fetchStationMonthly`.
- `StationHistograms` — 2-col grid of single-color histograms: distribution by uso (trips/station), distribution by alcance (reach %).

**Score donut segments:**
- 40 % cobertura por alcance (mean `reach_coverage`)
- 30 % viajes / bici / mes (normalized)
- 30 % densidad estaciones / km² (normalized)

### 4. Accidents — `AccidentsStats.tsx`

**Map layer toggle** (replaces filter pills) at top:
- ● Todos accidentes (9,478) — gris
- ● Bicicleta (1,234) — rojo
Both layers visible together; toggles control opacity.

**Pills (only 2 mains, no sub-pills):**
- Main: **Total accidentes** `9,478`
- Main: **Con bicicleta** `1,234`

**Charts:**
- 2-col grid of paired comparisons:
  - `StackedBarMatrix`: **Ciclista × vehículo** — rows: Coche/Furg, Bus, Camión/Maq, Moto, Bicicleta, — Caída sola. Each bar = 100 % of row, segments = severity (Ileso / Leve / Grave / Fatal). Right-side count.
  - `StackedBarMatrix`: **Peatón × vehículo** — rows: Coche/Furg, Bus, Camión/Maq, Moto, Bicicleta, Bici eléc. Same structure as cyclist chart for direct comparison.
- Below 2-col grid: full-width `BarHistogram`-style chart **Bicicleta: regular vs EPAC × seco vs lluvia** — 4 categorical bars (Regular·seco, Regular·lluvia, EPAC·seco, EPAC·lluvia).

**No score donut, no rank** — accidents are absolute counts; ranking would penalize large cities and reward data-poor ones.

✅ Color clash resolved: Traffic mode moves to **dark green** (`var(--green-dark)` or `#14532d`). Accidents keeps `var(--red)`. No further action needed.

---

## Reusable primitives

### MetricPill

```tsx
interface MetricPillProps {
  value: string;
  label: string;
  sublabel?: string;     // for the small text under value
  icon?: ComponentType<{ className?: string }>;
  size: 'main' | 'sub';
  helpContent?: ReactNode; // when present, ❓ icon shows; click flips content
}
```

Renders as a rounded card on a translucent white surface. Main and sub share the same height; size only affects width and primary text size. ❓ icon top-right; click swaps content with help text. Click again or click ✕ to flip back.

### BarHistogram

```tsx
interface BarHistogramProps {
  data: { label: string; value: number }[];
  accent: string;
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
  gradient?: boolean;
  referenceLineX?: number;
  referenceLabel?: string;
}
```

Recharts `<BarChart>` inside a `GlassCard`. Optional vertical dashed reference line.

### StackedBarMatrix

```tsx
interface StackedBarMatrixProps {
  rows: { label: string; total: number; segments: { value: number; color: string; label: string }[] }[];
  segmentLabels: string[];   // e.g. ['Ileso', 'Leve', 'Grave', 'Fatal']
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
  onRowClick?: (rowLabel: string) => void;
}
```

Each row is a 100%-stacked horizontal bar with per-row total displayed at the right. Segments share the same color scale across rows for direct comparison. Optional click handler.

### LineAreaChart

```tsx
interface Series {
  key: string;
  label: string;
  color: string;
  type?: 'line' | 'area';
  axis?: 'primary' | 'secondary';
  dashed?: boolean;
}
interface LineAreaChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
}
```

Recharts `<ComposedChart>`. Supports dual y-axis (e.g. trips on primary, active stations on secondary).

### ScoreDonut + CityRankTable

```tsx
interface ScoreSegment {
  label: string;
  weight: number;     // 0-1, must sum to 1
  value: number;      // 0-1 (city score for this metric)
  color: string;
}
interface ScoreDonutProps {
  segments: ScoreSegment[];
  cityName: string;
  overallScore: number;  // 0-100
  accent: string;
}
interface CityRankTableProps {
  cities: { id: number; name: string; score: number; isCurrent?: boolean }[];
  accent: string;
  pageSize?: number;  // default 8, current city always pinned
}
```

Two separate components rendered side-by-side in `grid-cols-2`. Score donut is a Recharts `<RadialBarChart>` ring with overall score in the center and segment legend below. Rank table sorts descending by score; current city is pinned with `▶` and remains visible regardless of pagination.

### HelpContext + HelpAnchor

```tsx
// HelpContext
interface HelpRegistry {
  register(id: string, ref: RefObject<HTMLElement>, kind: 'mode-help' | 'map-help'): void;
  focus(id: string): void;  // scrolls into view + glow on ultrawide; opens MapHelpPanel pre-scrolled otherwise
}

// HelpAnchor
interface HelpAnchorProps {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}
```

`HelpAnchor` renders a collapsible pill (details/summary). On `focus(id)`, applies a 1.5s `glow` CSS keyframe animation (box-shadow pulse).

### MapHelpButton + MapHelpPanel

```tsx
// MapHelpButton — lives in MapControls
// Click → calls useLayoutMode() to decide:
//   - 'mobile' or 'desktop'  → open <MapHelpPanel/> overlay on the map
//   - 'ultrawide'            → call helpCtx.focus('default-help-anchor')

interface MapHelpPanelProps {
  anchors: { id: string; title: string }[];   // from HelpContext registry filtered by kind='map-help'
  onClose: () => void;
}
```

Floating panel anchored bottom-left of map area on desktop; full-width slide-up sheet on mobile. Closes on outside tap or ✕.

### ServiceNamePill

Stations-only. Rounded green badge with MapPin icon and `city.service_name`.

### MayorsGanttChart

```tsx
interface MayorTerm {
  name: string;
  party: string;
  start_date: string;   // ISO date string, e.g. "2019-06-15"
  end_date: string | null;  // null = current incumbent
}
interface MayorsGanttChartProps {
  terms: MayorTerm[];
  partyColors: Record<string, string>;  // party name → hex color; unknown parties fall back to gray
  title?: string;
}
```

Standard horizontal Gantt — one bar per mayor term on a shared time axis spanning all available history. Rendered as custom SVG using `d3-scale` for the time axis (Recharts has no Gantt primitive). Bar height is fixed (32px); axis ticks in years. Bars are labeled with mayor name + party abbreviation when width allows. Current incumbent bar extends to today with a dashed right edge. Clicking a bar does nothing (display only).

Party color mapping: defined in `constants/parties.ts` as a static `Record<string, string>`. Any party not in the map receives `#9ca3af` (neutral gray).

### BudgetSunburst

```tsx
interface BudgetNode {
  code: string;         // e.g. "1", "13", "134", "1341"
  name: string;
  amount: number;       // in euros
  children?: BudgetNode[];
}
interface BudgetSunburstProps {
  data: BudgetNode;               // root node built from category_code hierarchy
  year: number;                   // latest year from backend
  budgetType: 'planned' | 'executed';
  onBudgetTypeChange: (type: 'planned' | 'executed') => void;
  title?: string;
}
```

D3 partition layout (`d3-hierarchy` + `d3-shape` arc) rendered as an SVG sunburst. Max depth = 3 levels (root → section → group → article). Color by top-level section using a fixed palette. Toggle between `planned`/`executed` via pill buttons at the top; triggers re-render with new data (not animation). Hovering a segment shows tooltip: name, amount in €, % of total. The `year` field is displayed as a subtitle ("Presupuesto YYYY").

Backend returns the flat `category_code` list; tree is assembled client-side: a code is parent of another if the shorter code is a prefix (e.g. `"134"` is parent of `"1341"`). Root node aggregates all top-level sections.

---

## File structure

```
frontend/src/
├── components/city/
│   ├── CityStats.tsx                    ← thin mode router
│   ├── CityHero.tsx                     ← extracted from MapDesktop, includes 3 score badges
│   ├── stats/
│   │   ├── InfraStats.tsx
│   │   ├── TrafficStats.tsx
│   │   ├── StationsStats.tsx
│   │   ├── AccidentsStats.tsx
│   │   └── GeneralContext.tsx           ← cream section: mayors timeline + budget sunburst
│   ├── pills/
│   │   ├── MetricPill.tsx
│   │   └── ServiceNamePill.tsx
│   ├── plots/
│   │   ├── BarHistogram.tsx
│   │   ├── StackedBarMatrix.tsx
│   │   ├── LineAreaChart.tsx
│   │   ├── ScoreDonut.tsx
│   │   ├── CityRankTable.tsx
│   │   ├── BuildingsDensityHistogram.tsx
│   │   ├── RouteHistograms.tsx
│   │   ├── StationMonthlyChart.tsx
│   │   ├── StationHistograms.tsx
│   │   ├── MayorsGanttChart.tsx          ← d3-scale SVG Gantt; colored by party
│   │   └── BudgetSunburst.tsx            ← d3-hierarchy sunburst; planned/executed toggle
│   ├── help/
│   │   ├── HelpContext.tsx
│   │   ├── HelpAnchor.tsx
│   │   ├── MapHelpButton.tsx
│   │   └── MapHelpPanel.tsx
│   └── map/...                          ← existing layer module
└── hooks/
    ├── useInfraStats.ts                 ← split from useLiveStats
    ├── useTrafficStats.ts
    ├── useStationsStats.ts
    ├── useAccidentsStats.ts
    ├── useMayorHistory.ts               ← fetches historical_mayors for city
    └── useCityBudgets.ts                ← fetches budget categories; exposes budgetType toggle
```

---

## Map layer fixes

### Fix 1: Register AccidentsLayer in MODES registry

File: `frontend/src/components/city/map/modes/index.ts`

Add imports + entry:
```ts
import AccidentsLayer from './accidents/AccidentsLayer';
import AccidentsLegend from './accidents/AccidentsLegend';
// ...
[MAP_MODES.ACCIDENTS]: {
    layer: AccidentsLayer,
    legend: AccidentsLegend,
    submodes: [],
    defaultSubmode: '',
},
```

AccidentsLayer is fully implemented; no layer-internal changes needed. The map layer toggle (all/bike) will be added in a follow-up — for now AccidentsLayer continues to render all severities.

### Fix 2: Connected components in InfrastructureLayer

File: `frontend/src/components/city/map/modes/infrastructure/InfrastructureLayer.tsx`

Currently a 12-line stub. Required behavior:
1. On mount, fetch `fetchInfraComponents(city.id)` → GeoJSON with `component_id` per edge.
2. Add `infra-components-source` and a line layer `infra-components-layer`.
3. Color expression on `component_id`: GCC component highlighted in `var(--blue)`, other components in increasingly desaturated blues, isolated edges in gray.
4. Hide `bike-paths-layer` while infra mode is active; restore on unmount.
5. Show component count + GCC indicator in the legend (`InfrastructureLegend`).

---

## Backend changes

### `backend/api/models.py`

Add to `CityResponse`:
```python
mode_scores: Optional[Dict[str, Dict[str, Any]]] = None
# Example structure:
# { "infrastructure": { "overall": 72, "segments": [{label, weight, value, color}], ... },
#   "traffic":        { "overall": 58, ... },
#   "stations":       { "overall": 81, ... } }
```

Add to `TrafficResponse`:
```python
available_periods: Optional[List[str]] = None   # YYYY-MM strings desc-sorted
```

### `backend/api/routes.py`

- `list_networks` and `get_city`: call new `compute_mode_scores(city_id)` per city, merge into response.
- `get_traffic` (existing endpoint): add a side query for distinct `month` values and include in response.

### `backend/database/db_io/scores.py` (new)

```python
def compute_mode_scores(conn, city_id: int) -> Dict[str, Dict[str, Any]]:
    """
    Compute per-mode score (0-100) for the given city.
    Each score returned with:
      - overall: int
      - segments: list of {label, weight, value, color}
    Mode-specific normalizations are computed against all cities with that mode.
    Returns dict keyed by mode (infrastructure/traffic/stations).
    Accidents not included — no rankable score.
    """
```

Implementation notes:
- Pre-fetch the corpus of cities-with-mode and normalize each segment value against (min, max) of the corpus.
- Cache results per request via `functools.lru_cache` keyed by city_id + mode (clear on ingestion writes).
- Score formulas exactly match the donut segment specs above.

### `backend/api/routes.py` — new `/cities/{id}/context` endpoint

```python
GET /cities/{city_id}/context → CityContextResponse
```

```python
class MayorTermResponse(BaseModel):
    name: str
    party: str
    start_date: Optional[date]
    end_date: Optional[date]   # None = current incumbent

class BudgetCategoryResponse(BaseModel):
    code: str         # e.g. "134", "1341"
    name: str
    amount: int       # euros

class CityContextResponse(BaseModel):
    mayors: List[MayorTermResponse]              # full history, asc by start_date
    budget_year: int                             # latest year with data
    budget_categories: Dict[str, List[BudgetCategoryResponse]]  # key = 'planned' | 'executed'
```

Query logic:
- `mayors`: `SELECT name, party, start_date, end_date FROM historical_mayors WHERE city_id = ? ORDER BY start_date ASC`
- `budget_year`: `SELECT MAX(year) FROM city_budget_categories WHERE city_id = ?`
- `budget_categories`: `SELECT budget_type, category_code, category_name, amount FROM city_budget_categories WHERE city_id = ? AND year = budget_year`

Frontend tree assembly (client-side): code `"134"` is parent of `"1341"` iff `"1341".startsWith("134")` and `len("1341") == len("134") + 1`. Sort by code before assembling.

### `frontend/src/constants/parties.ts` (new or extend existing)

Static mapping of Spanish party names → hex color. Used by `MayorsGanttChart`. Example entries:
```ts
export const PARTY_COLORS: Record<string, string> = {
  "PP": "#0066CC",
  "PSOE": "#E40035",
  "Ciudadanos": "#FF6600",
  "Más Madrid": "#00A86B",
  "Ahora Madrid": "#6A0DAD",
  // … extend as needed; unknown → "#9ca3af"
};
```

---

## Implementation sequence

| Step | File(s) | Description | Status |
|------|---------|-------------|--------|
| 1 | `modes/index.ts` | Register AccidentsLayer (4 lines, immediate visual unblock) | ✅ done |
| 2 | `InfrastructureLayer.tsx` | Implement components fetch + color-coded line layer | ✅ done |
| 3 | `npm install recharts d3-scale d3-shape d3-hierarchy d3-time-format` | Dependencies for all charts | ✅ done |
| 4 | `pills/MetricPill.tsx` | Reusable pill with size variants and ❓ flip | ✅ done |
| 5 | `pills/ServiceNamePill.tsx` | Stations-only badge | ✅ done |
| 6 | `help/HelpContext.tsx` + `HelpAnchor.tsx` | Help registry + collapsible pill with glow animation | ✅ done |
| 7 | `help/MapHelpButton.tsx` + `MapHelpPanel.tsx` | Map-anchored help; layout-mode dispatch | ✅ done |
| 8 | `plots/BarHistogram.tsx` | Reusable single-series bar chart | ✅ done |
| 9 | `plots/StackedBarMatrix.tsx` | Reusable rows × ordered categorical | ✅ done |
| 10 | `plots/LineAreaChart.tsx` | Reusable multi-series timeseries | ✅ done |
| 11 | `plots/ScoreDonut.tsx` + `CityRankTable.tsx` | Score visualization paired components | ✅ done |
| 12 | `backend/database/db_io/scores.py` (new) | Score computation per mode | ✅ done |
| 13 | `backend/api/models.py` | Add `mode_scores` to CityResponse, `available_periods` to TrafficResponse | ✅ done |
| 14 | `backend/api/routes.py` | Wire scores into `/cities` and `/cities/{id}`; add periods to `/traffic` | ✅ done |
| 15 | `frontend/src/services/api.ts` + `constants/cities.ts` | Type updates for `mode_scores` and `available_periods` | ✅ done |
| 16 | `hooks/useInfraStats.ts` | Per-mode hook, replaces `useLiveStats` infra branch | ✅ done |
| 17 | `plots/BuildingsDensityHistogram.tsx` | Infra-specific chart | ✅ done |
| 18 | `stats/InfraStats.tsx` | First per-mode panel — full integration test | ✅ done |
| 19 | `hooks/useTrafficStats.ts` | Per-mode hook | ✅ done |
| 20 | `plots/RouteHistograms.tsx` | Traffic-specific chart | ✅ done |
| 21 | `stats/TrafficStats.tsx` | Moves selection pills, adds charts | ✅ done |
| 22 | `hooks/useStationsStats.ts` | Per-mode hook | ✅ done |
| 23 | `plots/StationMonthlyChart.tsx` + `plots/StationHistograms.tsx` | Stations charts | ✅ done |
| 24 | `stats/StationsStats.tsx` | With service pill | ✅ done |
| 25 | `hooks/useAccidentsStats.ts` | Computes severity/category/condition aggregates from GeoJSON | ✅ done |
| 26 | `stats/AccidentsStats.tsx` | 2-col paired charts + EPAC×lluvia chart | ✅ done |
| 27 | `components/city/CityHero.tsx` | Extract from MapDesktop, add 3 score badges | ✅ done |
| 28 | `backend/api/routes.py` + `backend/api/models.py` | Add `GET /cities/{id}/context` endpoint (mayors + budget categories) | ✅ done |
| 29 | `constants/parties.ts` | Static party → hex color mapping | ✅ done |
| 30 | `hooks/useMayorHistory.ts` + `hooks/useCityBudgets.ts` | Data hooks for context endpoint; `useCityBudgets` exposes `budgetType` toggle state | ✅ done |
| 31 | `plots/MayorsGanttChart.tsx` | d3-scale SVG Gantt; colored by party; current incumbent dashed | ✅ done |
| 32 | `plots/BudgetSunburst.tsx` | d3-hierarchy sunburst; planned/executed toggle; tooltip; client-side tree assembly | ✅ done |
| 33 | `stats/GeneralContext.tsx` | Cream section: MayorsGanttChart (full width) above BudgetSunburst (full width) |
| 34 | `CityStats.tsx` | Refactor to thin mode router; remove all mode-specific logic |
| 33 | `stats/GeneralContext.tsx` | Cream section: MayorsGanttChart (full width) above BudgetSunburst (full width) | ✅ done |
| 34 | `CityStats.tsx` | Refactor to thin mode router; remove all mode-specific logic | ✅ done |
| 35 | `MapDesktop.tsx` | Use new `CityHero`; render `CityStats` (router) below; render `GeneralContext` below that | ✅ done |

---

## Verification

End-to-end manual checks after each major step:
1. **Step 1**: Madrid → Accidents mode → dots appear colored by severity, click → popup shows participants.
2. **Step 2**: Madrid → Infrastructure mode → map shows color-coded connected components, GCC dominant.
3. **Steps 4-7**: Render storybook (or empty test page) using each primitive in isolation; confirm flip animation, glow keyframe, panel overlay positioning.
4. **Step 11**: ScoreDonut renders correctly with mock data; rank table pins current city.
5. **Step 14**: `curl /cities/1` returns `mode_scores` populated; `curl /cities/1/traffic` returns `available_periods`.
6. **Step 18**: InfraStats panel renders pills, BuildingsDensityHistogram, score donut + rank, all linked to live data for Madrid.
7. **Step 21**: TrafficStats — period/generation/routing pills change values; route histograms re-render.
8. **Step 24**: StationsStats — BiciMAD pill shows; monthly chart renders both estimated and real series.
9. **Step 26**: AccidentsStats — paired Ciclista/Peatón × vehículo charts render side-by-side; EPAC×lluvia bar chart correctly counts categories from accident participants + weather data.
10. **Step 27**: Hero shows 3 score badges (or fewer if mode unavailable); badges click-through to mode.
11. **Step 33**: GeneralContext renders MayorsGanttChart with full history colored by party; BudgetSunburst shows latest year, toggle switches planned ↔ executed.
12. **Step 35**: All four modes navigable via hero badges and existing MapFilters; GeneralContext appears below in cream regardless of mode.

---

## Open items / out of scope

- **Mobile sheet integration** — per-mode panels need to be tested in `MapSheetContent` (mobile bottom sheet); chart compactness in 75px-collapsed → fullsheet transitions to be validated.
- **Ultrawide DualPanel** — verify the help glow scroll-target works correctly when right column has its own scroll context.
- **Weather and EPAC data confirmed available**: `weather` column is ingested into the `accidents` table from Madrid CSVs. `tipo_vehiculo` in `accident_participants` contains `"Bicicleta EPAC (pedaleo asistido)"` as a distinct value — EPAC detection works without a backend helper. The EPAC×lluvia chart is fully implementable.
- **Party color completeness** — `constants/parties.ts` must be extended as new cities are added (non-Madrid parties will default to gray until added to the map).
