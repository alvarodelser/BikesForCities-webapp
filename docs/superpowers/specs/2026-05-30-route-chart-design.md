# Route Chart Component — Design Spec

**Date:** 2026-05-30

## Overview

A React component that displays a hand-crafted SVG route (drawn in Inkscape) with city markers dynamically overlaid. Each city is positioned along the winding route path based on its score, with a horizontal leader line extending to the right margin and the city name label there.

## Visual Structure

- **Background SVG**: Drawn manually in Inkscape. Depicts a winding, serpentine cycling route that curves back on itself, with a color gradient from red/orange (bottom, low score) to cyan/teal (top, high score). Exported and inlined as JSX.
- **City markers**: A dot on the path edge, a horizontal line to the right margin, and a city name label — all rendered as SVG elements on top of the static artwork.
- **Right margin labels**: City names displayed at their natural Y position (derived from path geometry), ordered by score.

## Data Model

```typescript
interface City {
  name: string;
  score: number; // numeric score; higher = higher on the route
}
```

The component receives `cities: City[]` as a prop. No other data is needed.

## Score → Path Position Mapping

- Normalize each city's score: `t = (score - minScore) / (maxScore - minScore)`
- `t = 0` → bottom of path (path start), `t = 1` → top of path (path end)
- Use native browser API: `pathEl.getPointAtLength(t * pathEl.getTotalLength())`
- `minScore` and `maxScore` are derived from the cities array at runtime (no hardcoded values)

## Component Architecture

### File: `RouteChart.tsx`

```
RouteChart (React component)
├── svgRef: RefObject<SVGSVGElement>
├── cityPoints: { name, x, y }[]  — computed in useEffect
├── Renders: inlined SVG artwork  (id="route-path" on the winding path)
└── Renders: overlay layer (dots, leader lines, labels)
```

### SVG Requirements (Inkscape export)

The exported SVG must have:
- `id="route-path"` on the main winding path element
- A defined `viewBox` (the component reads right-margin X from it)

### Overlay Elements (per city)

1. `<circle>` at `(pt.x, pt.y)` — small dot marking position on path
2. `<line>` from `(pt.x, pt.y)` to `(rightMarginX, pt.y)` — horizontal leader line
3. `<text>` at `(rightMarginX + 8, pt.y)` — city name

`rightMarginX` is read from the SVG's `viewBox` width at mount time.

## Placement in the App

A new component at `frontend/src/components/city/RouteChart.tsx`. The SVG asset lives at `frontend/src/assets/route-chart.svg` (or inlined directly in the component file). Integration point TBD by the user once Inkscape artwork is ready.

## What Is NOT in Scope

- Hover/click interactions on city markers
- Animations
- Responsive resizing (SVG scales via `viewBox` naturally)
- Label collision avoidance (deferred — revisit if needed with real data)
