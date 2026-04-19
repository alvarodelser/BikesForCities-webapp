# Traffic Mode — Edge Click & Route Overlay

**Date:** 2026-04-19  
**Status:** Approved

---

## Overview

When the user clicks a road segment in traffic mode, the map draws all complete routes that pass through that edge. Two visualisation sub-modes are available via a legend toggle: **Trazas** (individual semi-transparent route traces, default) and **Calor** (origin-destination heatmap). A small non-intrusive popup anchored to the clicked point shows the street name (if known) and the monthly trip count.

Clicking empty space deselects and removes the overlay. Nodes are out of scope.

---

## Frontend

### 1. `modes/index.ts`

Add submodes to the traffic entry:

```ts
traffic: {
    layer:          TrafficLayer,
    legend:         TrafficLegend,
    submodes:       ['traces', 'heatmap'],
    defaultSubmode: 'traces',
},
```

### 2. `TrafficLegend.tsx`

Add a TRAZAS | CALOR pill toggle in the header row, identical in structure to the StationsLegend toggle. Reads `submode` from `useMapState()` and calls `setSubmode`.

```
[TRAZAS]  [CALOR]     ← pill toggle, top-right of header
Viajes por Calle
(viajes estimados / mes)
[gradient bar + quantile labels]   ← unchanged
```

No selected-state section in the legend.

### 3. `CityCanvas.tsx`

Update the `traffic-layer` paint expression to check `feature-state.selected` before the trip-count interpolation:

```ts
'line-color': [
    'case',
    ['==', ['feature-state', 'selected'], true], '#f0c040',
    ['!=', ['feature-state', 'trip_count'], null],
    ['interpolate', ['linear'], ['feature-state', 'trip_count'],
        0, '#edf8e9', 10, '#c7e9c0', 50, '#a1d99b', 100, '#74c476',
        500, '#41ab5d', 1000, '#238b45', 5000, '#005a32'],
    '#edf8e9',
],
'line-width': ['case', ['==', ['feature-state', 'selected'], true], 5, 3],
```

### 4. `TrafficLayer.tsx`

**Props:** add `submode: string` (already required by ModeConfig interface).

**New refs:**
- `popupRef` — `maplibregl.Popup`
- `stickyEdgeRef` — `{ edgeId: number; lngLat: maplibregl.LngLat } | null`
- `trafficDataRef` — `Map<number, number>` (edge_id → trip_count, kept in sync with the data-fetch effect so the click handler can look up trip_count without an extra API call)

**Overlay sources/layers added dynamically on click (removed on deselect):**

| Source ID | Layer ID | Purpose |
|---|---|---|
| `route-traces-source` | `route-traces-layer` | GeoJSON LineStrings for traces mode |
| `route-od-source` | `route-od-layer` | GeoJSON Points for heatmap mode |

Both are cleaned up on unmount and on deselect.

**Click handler (on `traffic-layer`):**

1. Get `edgeId = feature.id` (numeric primary key from Martin vector tile).
2. Get `edgeName = feature.properties?.name ?? null`.
3. Get `tripCount` via `map.getFeatureState({ source: 'edges-source', sourceLayer: 'edges', id: edgeId })?.trip_count ?? 0`.
4. Highlight selected edge: `map.setFeatureState(…, { selected: true })`. The `traffic-layer` paint expression in `CityCanvas.tsx` must be updated to check `feature-state.selected` first, overriding the trip-count colour with `#f0c040` and width 5. On deselect, call `setFeatureState(…, { selected: false })`.
5. Show popup (DOM-based, same pattern as StationsLayer): street name + trip count badge + ✕ close button.
6. Fetch `GET /cities/{city_id}/edges/{edge_id}/routes?mode={submode}&limit=500`.
7. Remove previous overlay sources/layers if present.
8. Render overlay based on submode (see below).

**Deselect:** click on empty space → clear highlight, remove popup, remove overlay sources/layers.

**Submode change effect:** if `stickyEdgeRef` is set when submode changes, re-fetch and re-render the overlay for the same edge with the new mode. This lets the user toggle between traces and heatmap while a segment is selected.

---

### Overlay rendering

#### Traces mode (`submode === 'traces'`)

API returns a GeoJSON `FeatureCollection` of `LineString` features (one per route).

```ts
map.addSource('route-traces-source', { type: 'geojson', data: geojson });
map.addLayer({
    id: 'route-traces-layer',
    type: 'line',
    source: 'route-traces-source',
    paint: {
        'line-color': '#f59e0b',   // amber
        'line-width': 1.5,
        'line-opacity': 0.28,
    },
});                                // inserted above traffic-layer so traces are visible over the base heatmap
```

#### Heatmap mode (`submode === 'heatmap'`)

API returns origin and destination points combined into a single GeoJSON `FeatureCollection` of `Point` features.

```ts
map.addSource('route-od-source', { type: 'geojson', data: geojson });
map.addLayer({
    id: 'route-od-layer',
    type: 'heatmap',
    source: 'route-od-source',
    paint: {
        'heatmap-radius': 20,
        'heatmap-opacity': 0.72,
        'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(68,1,84,0)',
            0.2, '#3b528b',
            0.4, '#21908c',
            0.6, '#5ec962',
            1.0, '#fde725',
        ],
    },
});
```

---

## Backend

### New endpoint

```
GET /cities/{city_id}/edges/{edge_id}/routes?mode=traces|heatmap&limit=500
```

- `mode` defaults to `traces`.
- `limit` defaults to 500; capped at 1000.
- Returns `{ data: GeoJSON.FeatureCollection, count: int, message: string }`.

### DB queries

**Traces** — reconstruct each route's geometry from its ordered edge segments:

```sql
SELECT ST_AsGeoJSON(
    ST_MakeLine(e.geom ORDER BY re.edge_order)
) AS geom
FROM route_edges re
JOIN edges e ON e.id = re.edge_id
WHERE re.route_id IN (
    SELECT DISTINCT route_id FROM route_edges WHERE edge_id = %(edge_id)s
)
GROUP BY re.route_id
LIMIT %(limit)s
```

Each row becomes a `Feature<LineString>` in the response `FeatureCollection`.

**Heatmap** — origin and destination lat/lon for each route:

```sql
SELECT
    n_o.lon AS origin_lon, n_o.lat AS origin_lat,
    n_d.lon AS dest_lon,   n_d.lat AS dest_lat
FROM routes r
JOIN nodes n_o ON n_o.id = r.origin_node
JOIN nodes n_d ON n_d.id = r.dest_node
WHERE r.id IN (
    SELECT DISTINCT route_id FROM route_edges WHERE edge_id = %(edge_id)s
)
LIMIT %(limit)s
```

Each origin and each destination becomes a separate `Feature<Point>` (two features per route), combined into one `FeatureCollection`.

### Pydantic models (add to `models.py`)

```python
class EdgeRoutesResponse(BaseResponse):
    data: Dict[str, Any]   # GeoJSON FeatureCollection
    count: int
```

---

## Interaction model

| User action | Result |
|---|---|
| Hover edge | Cursor changes to pointer |
| Click edge | Edge highlights yellow; popup appears; overlay loads |
| Click same edge again | No-op (already selected) |
| Click different edge | Previous deselected; new edge selected |
| Click empty space | Deselect; overlay and popup removed |
| Toggle TRAZAS ↔ CALOR while edge selected | Overlay re-fetched and re-rendered |
| Close popup (✕) | Deselect |
| Switch away from traffic mode | Overlay, popup, and highlight cleaned up on unmount |

---

## Error handling

- If the API call fails: remove any loading state, log to console. Popup stays with the trip count (from feature state). No overlay shown.
- If `trip_count` is null (edge has no traffic data): show `–` in the popup badge. Still fetch routes — the edge might have routes even if not in the current month's traffic snapshot.
- If 0 routes returned: show "Sin rutas registradas" in the popup body.

---

## Out of scope

- Node click
- Filtering by time period or direction
- Pagination of routes beyond the 500-route limit
