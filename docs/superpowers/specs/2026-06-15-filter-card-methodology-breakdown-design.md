# FilterCard Methodology Breakdown — Design Spec

**Date:** 2026-06-15
**Scope:** `TrafficStats` > `FilterCard` — METODOLOGÍA section inside the expanded help panel

---

## Problem

The METODOLOGÍA help text inside the Generación and Enrutamiento FilterCards bundles all option explanations into a single paragraph (e.g., "Real: … Estaciones: … Población: …"). Users who want to understand a specific option have to read through the whole blob.

## Goal

Show all options' metodologías individually, with the active selection surfaced first and the rest one click away.

---

## Affected component

**File:** `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx`
**Component:** `FilterCard` (internal)
**Section:** The `expanded && hasHelp` block, specifically the METODOLOGÍA subsection.

---

## Current data shape

Each `FilterCard` receives a single `helpComoSeRecogieron` string that describes all options in one paragraph. This needs to be replaced (or supplemented) with a per-option record.

**Generación options:** `real`, `station_based`, `buildings_population`
**Enrutamiento options:** `map_matched`, `shortest`, `safest`

---

## Proposed data shape

Add a new optional prop to `FilterCard`:

```ts
helpComoSeRecogieronPerOption?: Record<string, string>;
```

Keyed by option `value`. When present, this takes over the METODOLOGÍA section; `helpComoSeRecogieron` (the flat string) becomes a fallback for cards that don't need per-option breakdown.

---

## UI behavior

### METODOLOGÍA section — three states

**1. Active option highlighted (normal state)**
- A small labeled chip displays the active option's name (e.g., "GPS real") with a tinted background (`ACCENT` at ~10% opacity, border at ~20%).
- Below the chip, the active option's metodología text renders in full.
- Below that, a `Ver otros (N) ▾` toggle link (small, `text-[10px]`, muted color) indicates how many other options have descriptions. `N` = total options minus the active one.

**2. "Ver otros" expanded**
- Clicking the toggle reveals the remaining options as a stacked labeled list.
- Each entry: bold option name (`text-[10.5px] font-bold`) + metodología text (`text-[10.5px] text-black/55`), separated by a thin divider.
- The toggle label flips to `Ver otros ▴` (chevron up). Clicking again collapses.
- Collapse state resets when the help panel closes.

**3. No active selection**
- All options are shown as the labeled list with equal weight — no chip, no highlight, no collapse. The toggle is absent.

### Visual treatment

| Element | Style |
|---|---|
| Active chip label | `text-[9px] font-black uppercase tracking-widest`, tinted bg |
| Active metodología | `text-[10.5px] leading-relaxed text-black/75` |
| Toggle link | `text-[10px] font-semibold text-black/40 hover:text-black/65`, with inline `ChevronDown`/`ChevronUp` icon |
| Other option name | `text-[10.5px] font-bold text-black/65` |
| Other option text | `text-[10.5px] leading-relaxed text-black/55` |
| Divider between others | `border-t border-black/06 mt-2 pt-2` |

---

## Content — per-option metodología strings

### Generación

| Option | Value | Text |
|---|---|---|
| GPS real | `real` | Trayectos GPS del sistema de bici pública proyectados al nodo más cercano de la red (tolerancia 150 m). |
| Estaciones | `station_based` | Viajes sintetizados a partir de flujos de entrada/salida por estación. |
| Población | `buildings_population` | Modelo de gravedad donde la probabilidad de viaje es proporcional a la densidad de edificios del origen, la densidad de población del destino e inversamente proporcional a la distancia. |

### Enrutamiento

| Option | Value | Text |
|---|---|---|
| Map-matched | `map_matched` | Cada viaje GPS se ancla a los nodos más cercanos a inicio y fin (tolerancia 150 m); la ruta se resuelve por distancia mínima. |
| Ruta corta | `shortest` | Dijkstra con peso = longitud en metros. |
| Ruta segura | `safest` | Dijkstra con route_cost = length × (1 + peligrosidad × ln(max(length,1)) / 144); la peligrosidad depende del tipo de vía, velocidad máxima y número de carriles. |

---

## Implementation notes

- The `expanded` state for "Ver otros" is local to `FilterCard` — a separate `useState<boolean>` alongside the existing `expanded` (help open/close). Reset it when the help closes (`useEffect` on `expanded`).
- No new files needed. All changes are within `FilterCard` and the two call sites in `TrafficStats`.
- The flat `helpComoSeRecogieron` prop stays on `FilterCard` as a fallback; it renders unchanged when `helpComoSeRecogieronPerOption` is absent.
- `GENERATION_OPTIONS` and `ALGORITHM_OPTIONS` arrays in `TrafficStats.tsx` already have the `value` strings — use those as keys.

---

## Out of scope

- Mobile layout of `TrafficStats` (not currently rendered on mobile).
- Applying this pattern to `helpQueVes` or `helpPorQueEsUtil` — only METODOLOGÍA needs per-option breakdown.
- Changes to `MetricPill` or `MapHelpPanel`.
