# Analytics Plots — Design Document

## Context

This document specifies the data contracts, component structure, and visual design for all analytics plot components planned for the City Map page. Each section describes one plot, its data source (backend endpoint + frontend hook), the proposed chart type, and the component API.

All plots are React components placed inside `CityStats` per mode, rendered as `GlassCard` surfaces with the mode accent colour for theming. Library: **Recharts** (already compatible with the stack; add `recharts` dependency).

---

## 1. Monthly Users Evolution — Stations Mode

**Purpose:** Show how the estimated (and, when available, actual) monthly bike-share usage has evolved over time for the city. Reveals seasonality, growth trends, and the effect of fleet changes.

### Data source

```
GET /cities/{city_id}/stations/monthly
→ StationMonthlyPoint[]
  { month: string, estimated_trips: number|null, actual_trips: number|null, active_stations: number }
```

Frontend: `fetchStationMonthly(cityId)` → hook `useStationMonthly(city)`

### Chart type

**Area / Line chart** — dual series (estimated in dashed green, actual in solid green) sharing the same Y-axis (trips/month). Secondary Y-axis for `active_stations` as a step line in faint blue.

X-axis: month labels (abbreviated: "Jan '23"). Tooltip shows all three values. If only one series exists, show just that series.

### Component API

```tsx
// frontend/src/components/city/plots/StationMonthlyChart.tsx
interface StationMonthlyChartProps {
  data: StationMonthlyPoint[];
  accent: string;        // mode colour (var(--green))
  compact?: boolean;
}
```

### Visual details

- Card header: "Evolución de uso mensual"
- Estimated series: dashed area fill `accent/20`, line `accent`
- Actual series: solid area fill `accent/40`, line `accent-dark`
- When both series exist: add a legend dot-legend at top-right
- Empty state: "Sin datos históricos disponibles"

---

## 2. Route Length Histogram — Traffic Mode

**Purpose:** Show the distribution of simulated route lengths (km) per strategy. Allows comparison of how different generation types produce shorter/longer trips.

### Data source

```
GET /cities/{city_id}/traffic/histogram?bins=20
→ RouteHistogramSeries[]
  {
    generation_type, algorithm, n_routes,
    length_km: { bin_edges: number[], counts: number[] }
  }
```

Frontend: `fetchRouteHistogram(cityId, bins)` → hook `useRouteHistogram(city)`

### Chart type

**Grouped Bar chart** — one group of bars per bin, one bar per (generation_type, algorithm) strategy. Each bar is coloured by strategy with a colour palette (e.g. `var(--red)`, `var(--orange)`, `var(--yellow)`, `var(--blue)` for up to 4 strategies).

X-axis: bin midpoints in km (e.g. "0–1 km", "1–2 km"). Y-axis: count of routes. A mode filter toggle (pills) lets the user select which strategies to show.

### Component API

```tsx
// frontend/src/components/city/plots/RouteLengthHistogram.tsx
interface RouteLengthHistogramProps {
  data: RouteHistogramSeries[];
  accent: string;
  compact?: boolean;
}
```

### Visual details

- Card header: "Distribución de longitud de rutas"
- Subtitle: "km por ruta, todas las estrategias"
- Strategy colours: assign a fixed palette mapped to (gen_type, algo) pairs
- Tooltip: shows strategy label + route count for hovered bar
- If a single strategy, render as a single-colour histogram (no grouping)
- Empty state: "Sin datos de histograma"

---

## 3. Infrastructure Coverage Histogram — Traffic Mode

**Purpose:** Show the distribution of the fraction of each route that uses cycling infrastructure. A route with 100% infra fraction is fully on dedicated bike lanes.

### Data source

Same endpoint as above:
```
GET /cities/{city_id}/traffic/histogram?bins=20
→ RouteHistogramSeries[].infra_fraction: { bin_edges, counts }
```

The `infra_fraction` bins range from 0→1 (0%→100%).

### Chart type

**Grouped Bar chart** — same structure as route-length histogram. X-axis: bins as "0–5 %", "5–10 %", …, "95–100 %". Each strategy is a colour-coded bar within each bin.

Optionally overlay a vertical dotted line at the city-level `infra_fraction` mean (from `fetchTrafficInfraCoverage`).

### Component API

```tsx
// frontend/src/components/city/plots/InfraFractionHistogram.tsx
interface InfraFractionHistogramProps {
  data: RouteHistogramSeries[];
  meanInfraFraction?: number | null;
  accent: string;
  compact?: boolean;
}
```

### Visual details

- Card header: "Fracción de rutas en infraestructura ciclista"
- Subtitle: "% de cada ruta sobre carril bici"
- Mean line if available: dashed vertical line with label "Media: X%"
- Colour gradient option: single strategy → gradient from `accent/40` (0%) to `accent` (100%) per bar height

---

## 4. Station Histograms — Stations Mode

Two related histograms, shown side-by-side in a 2-column grid.

### 4a. Stations by Trips

**Purpose:** Distribution of stations by estimated monthly trips. Shows which stations are high-demand vs idle.

**Data source:** `fetchStations(cityId)` → `stations[].estimated_monthly_trips` (already fetched by `useLiveStats`). No new endpoint needed.

**Chart type:** Single histogram (bar chart). X-axis: trip count bins (0–100, 100–200, …). Y-axis: station count. Accent colour `var(--green)`.

### 4b. Stations by Coverage

**Purpose:** Distribution of stations by their 1 km reach coverage. Shows how well-placed stations are relative to the population.

**Data source:** `fetchStations(cityId)` → `stations[].reach_coverage` (already available).

**Chart type:** Single histogram. X-axis: coverage % bins (0–10%, 10–20%, …, 90–100%). Y-axis: station count. Colour: gradient from `accent/30` → `accent`.

### Component API

```tsx
// frontend/src/components/city/plots/StationHistograms.tsx
interface StationHistogramsProps {
  stations: StationData[];  // from fetchStations
  accent: string;
  compact?: boolean;
}
```

Internally renders two `<BarChart>` components in a `grid grid-cols-2` layout.

---

## 5. Budget Sunburst — City Context (All Modes)

**Purpose:** Show how the city's total budget is allocated across functional programmes. The innermost ring is total budget; outer rings drill into programmes (e.g. 153 = Vías Públicas, 342 = Deporte, etc.).

### Data source

```
GET /cities/{city_id}/budgets
→ BudgetYear[]
  { year, total_expenses, lines: BudgetCategory[] }
  BudgetCategory: { category_code, category_name, amount, budget_type }
```

Frontend: `fetchCityBudgets(cityId)` → hook `useCityBudgets(city)`

A year-picker control (dropdown or pill strip) lets users switch between available years. A toggle selects between `planned` and `executed` budget types.

### Chart type

**Sunburst / Zoomable pie.** Two rings:
- Inner ring: top-level budget areas (grouped by leading digit of category_code: 1xx = Servicios públicos, 2xx = Protección civil, 3xx = Seguridad/movilidad, 4xx = Social, etc.)
- Outer ring: individual programme lines

On click of an inner-ring segment: zoom to show only that sector's outer programmes.

Library: Recharts does not natively support sunburst. Use **D3** (`d3-hierarchy` + `d3-arc`) directly inside a React component, or use `react-vis-force` / `@nivo/sunburst`. Recommended: `@nivo/sunburst` (lightweight, SSR-safe).

### Visual details

- Card header: "Distribución presupuestaria {year}"
- Toggle: Planificado / Ejecutado
- Highlight cod. 153 (Vías Públicas) with the infrastructure accent colour
- Tooltip: programme name + amount in M€ + % of total
- Legend: top-level areas only (inner ring), colour-coded

### Component API

```tsx
// frontend/src/components/city/plots/BudgetSunburst.tsx
interface BudgetSunburstProps {
  budgets: BudgetYear[];
  accent: string;       // highlight colour for cycling-related codes
  compact?: boolean;
}
```

---

## 6. Mayors & Parties Timeline — City Context (All Modes)

**Purpose:** Show a Gantt-style timeline of mayors with their party affiliation, overlaid with election results (seat distribution over time). Helps correlate cycling investment decisions with political periods.

### Data source

```
GET /cities/{city_id}/mayors
→ { mayors: MayorRecord[], elections: ElectionResult[] }
  MayorRecord:    { name, party, start_date, end_date }
  ElectionResult: { year, party, votes, councilors }
```

Frontend: `fetchMayorsTimeline(cityId)` → hook `useMayorsTimeline(city)`

### Chart type

**Dual-panel Gantt + Stacked Bar chart.**

**Top panel — Mayor Gantt:**
Each mayor = a horizontal bar spanning `start_date` → `end_date`. Bars are coloured by party (a fixed party-colour mapping for Spanish parties: PP = blue, PSOE = red, Cs = orange, Vox = green, IU/UP = purple, etc.; unknown parties = gray). Labels show mayor name.

**Bottom panel — Council composition:**
A stacked bar per election year, stacks = parties, height = councilor count. Same party colour scheme.

X-axis is shared (year). A vertical dotted line can be toggled to show the current year.

### Visual details

- Card header: "Mandatos y composición municipal"
- Party colour palette: hardcoded map for well-known parties; hash-based fallback for others
- Tooltip on Gantt bar: mayor name, party, dates, duration
- Tooltip on stacked bar: party, votes, councilors
- Empty state for missing data: "Sin datos históricos de alcaldes"

### Component API

```tsx
// frontend/src/components/city/plots/MayorsTimeline.tsx
interface MayorsTimelineProps {
  mayors: MayorRecord[];
  elections: ElectionResult[];
  compact?: boolean;
}
```

---

## Implementation Sequence

| Priority | Component | Blocker | Effort |
|----------|-----------|---------|--------|
| 1 | `StationMonthlyChart` | Data available via `/stations/monthly` | Low |
| 2 | `StationHistograms` | Data from existing `/stations` endpoint | Low |
| 3 | `RouteLengthHistogram` + `InfraFractionHistogram` | Data via `/traffic/histogram` | Medium |
| 4 | `BudgetSunburst` | Data via `/budgets`; needs `@nivo/sunburst` | Medium |
| 5 | `MayorsTimeline` | Data via `/mayors`; custom D3/SVG Gantt | High |

## New npm dependencies required

```bash
npm install recharts          # for bar/line/area charts (1-4)
npm install @nivo/sunburst    # for budget sunburst (5)
# MayorsTimeline can be built with SVG + d3-scale (already transitive via maplibre)
```

## Placement in CityStats

Each plot lives in a `GlassCard` below the stat tiles. For the mode-specific plots:

- **Stations mode**: StationMonthlyChart (full width) + StationHistograms (2-col grid)
- **Traffic mode**: RouteLengthHistogram + InfraFractionHistogram (2-col grid)
- **All modes** (collapsible section "Contexto político"): BudgetSunburst + MayorsTimeline (2-col on ultrawide, stacked on desktop)

The `CityStats` component will conditionally render the right plots based on `mode` read from `useMapState()`, exactly as it already does for the computation cards.
