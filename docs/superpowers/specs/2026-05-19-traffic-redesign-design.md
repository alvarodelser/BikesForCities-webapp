# Traffic Mode UI Redesign

**Date:** 2026-05-19  
**Branch:** fix/traffic_tiling  
**Status:** Approved — ready for implementation

---

## Overview

The traffic mode is split into two independent submodes driven by the URL `?submode=` param:

- **`rutas`** — tile-based route visualization (existing behaviour, cleaned up)
- **`trips`** — hex O-D (origin-destination) flow visualization (new)

The legend generation/algorithm selectors are removed from the legend entirely (they already exist in TrafficStats). The Trayecto/Calor toggle moves from URL state to local state within the selection panel. TrafficModeSelectors.tsx is deleted.

---

## 1. Submode Routing & Component Split

### URL State
`?submode=rutas|trips` is the single source of truth, read via `useMapState()`. Default: `rutas`.

### ActiveLayer
For traffic mode, `ActiveLayer` branches on submode:
- `submode === 'trips'` → mount `TrafficTripsLayer`
- anything else → mount `TrafficRoutesLayer` (renamed from `TrafficLayer.tsx`)

Both components read everything from `useMapState()` and map context — no props needed beyond what `ActiveLayer` already passes.

### TrafficModeLayer wrapper (new thin component)
`ActiveLayer` calls `config.layer` with a `submode` prop. A new `TrafficModeLayer.tsx` acts as the entry point for traffic and branches internally:

```tsx
export default function TrafficModeLayer({ submode }: { submode: string }) {
  if (submode === 'trips') return <TrafficTripsLayer />;
  return <TrafficRoutesLayer />;
}
```

`ActiveLayer.tsx` is unchanged.

### modes/index.ts
```ts
[MAP_MODES.TRAFFIC]: {
  layer:          TrafficModeLayer,
  legend:         TrafficLegend,
  stats:          TrafficStats,
  submodes:       ['rutas', 'trips'],
  defaultSubmode: 'rutas',
}
```

### CityLegend.tsx
- Remove `&& mode !== 'traffic'` exclusion (line 76) so traffic participates in the standard submode dropdown
- Add to `SUBMODE_LABELS`: `rutas: 'Rutas'`, `trips: 'Origen-Destino'`
- Remove `traces` and `heatmap` entries

### MapFilters.tsx
```ts
VIZ_SUBMODES[MAP_MODES.TRAFFIC] = {
  items: [
    { id: 'rutas',  label: 'Rutas'          },
    { id: 'trips',  label: 'Origen-Destino' },
  ],
  // requiresEdge removed — always visible when traffic is active
}
```

---

## 2. TrafficRoutesLayer (renamed from TrafficLayer.tsx)

Existing behaviour is preserved. One meaningful change: Trayecto/Calor moves from URL to local state.

### Trayecto / Calor — local state only
```ts
const [renderMode, setRenderMode] = useState<'traces' | 'heatmap'>('traces');
```

The `submodeOptions` in SelectionDetail now calls `setRenderMode` (local) instead of `setSubmode` (URL). `loadRoutes` reads from a `renderModeRef` instead of `submodeRef`.

### Deletions from this file
- `traffic-od-toggle` event listener
- `renderODFlows`, `renderSpider`, `clearODFlows`
- `odFlowsRef`, `odActiveRef`
- All OD source/layer constants (`OD_FLOW_SOURCE`, `OD_FLOW_LAYER`, `OD_SPIDER_SOURCE`, `OD_SPIDER_LAYER`)

### TrafficModeSelectors.tsx
**Deleted.** Generation/algorithm are in TrafficStats. OD toggle is replaced by the submode system.

---

## 3. TrafficTripsLayer (new file)

### Data loading
On mount and whenever `generation` or `period` changes:
```ts
fetchODFlows(city.id, generation, period)
```

- `min_trips` is not passed — the backend auto-computes it (see backend section)
- Result cached in `odFlowsRef`

### Arched flow lines
All LineString features (orig hex center → dest hex center) are pre-processed into Bézier curves before adding to MapLibre. Algorithm:

1. Given origin `O = [lon0, lat0]` and destination `D = [lon1, lat1]`
2. Midpoint `M = [(lon0+lon1)/2, (lat0+lat1)/2]`
3. Perpendicular offset: rotate `(D−O)` by 90°, scale by `0.35`
4. Control point `C = M + offset`
5. Sample 20 points along quadratic Bézier `B(t) = (1−t)²O + 2(1−t)tC + t²D`

Applied when building the GeoJSON, no extra library needed.

### Hex polygon layer
Extract unique `orig_hex` IDs from `odFlowsRef`. For each:
- `h3.cellToBoundary(hexId)` returns `[lat, lng][]` pairs — convert to `[lng, lat][]` for GeoJSON
- Build a `Polygon` feature with numeric `id` (index) for `setFeatureState` and `orig_hex` property

**Sources and layers:**

| Constant | Type | Purpose |
|---|---|---|
| `OD_HEX_SOURCE` | GeoJSON | Hex polygon features |
| `OD_HEX_FILL_LAYER` | fill | Glass-like hex fill |
| `OD_HEX_LINE_LAYER` | line | Hex border |
| `OD_FLOW_SOURCE` | GeoJSON | Top 150 global OD arched lines |
| `OD_FLOW_LAYER` | line | Purple global flows |
| `OD_SPIDER_OUT_SOURCE` | GeoJSON | Outbound flows from selected hex |
| `OD_SPIDER_OUT_LAYER` | line | Amber outbound spider |
| `OD_SPIDER_IN_SOURCE` | GeoJSON | Inbound flows to selected hex |
| `OD_SPIDER_IN_LAYER` | line | Blue inbound spider |

**Hex fill styling:**
```
default:  fill-color white, fill-opacity 0.06
          line-color rgba(255,255,255,0.35), line-width 1
hover:    fill-opacity 0.18 (via setFeatureState)
          line-color rgba(255,255,255,0.70)
```

**Global flow lines (OD_FLOW_LAYER):**
- Sorted descending by `count`, top 150 rendered
- `line-color: #7c3aed` (purple)
- `line-width`: interpolate weight 0→0.8, 1→5
- `line-opacity`: interpolate weight 0→0.2, 1→0.65
- Not interactive in general mode (no click/hover handlers)

### Hex interaction
**Hover (OD_HEX_FILL_LAYER):**
```ts
map.on('mouseenter', OD_HEX_FILL_LAYER, e => {
  map.setFeatureState({ source: OD_HEX_SOURCE, id: e.features[0].id }, { hover: true });
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', OD_HEX_FILL_LAYER, () => {
  // clear hover state on previous feature
  map.getCanvas().style.cursor = '';
});
```

**Click (OD_HEX_FILL_LAYER):**
1. Read `orig_hex` from feature properties
2. Store in `selectedHexRef`
3. `setFeatureState({ selected: true })` on clicked hex
4. Dispatch `trips-hex-selected` window event `{ hex: origHex }` (consumed by TrafficLegend)
5. Call `renderSpider(origHex)`

**renderSpider(origHex):**
```ts
const outbound = odFlowsRef.current.features
  .filter(f => f.properties.orig_hex === origHex);
const inbound = odFlowsRef.current.features
  .filter(f => f.properties.dest_hex === origHex);

// Re-normalise each set independently by its own max count
// Render outbound → OD_SPIDER_OUT_LAYER (amber #f59e0b)
// Render inbound  → OD_SPIDER_IN_LAYER  (blue  #3b82f6)
```

**Hover on spider layers (only active when hex is selected):**
```ts
// on both OD_SPIDER_OUT_LAYER and OD_SPIDER_IN_LAYER:
map.on('mouseenter', layer, e => {
  const count = e.features[0].properties.count;
  popup.setLngLat(e.lngLat).setHTML(`${count} viajes`).addTo(map);
});
map.on('mouseleave', layer, () => popup.remove());
```

**Click on map background (miss hex):**
- If hits nothing: clear both spider layers, clear `selectedHexRef`, clear `setFeatureState`, dispatch `trips-hex-selected` with `{ hex: null }`

**No SelectionPanel dispatch.** Hex interaction is purely visual.

### Mount / unmount
- On mount: hide `stations-layer`, `bike-paths-layer`; does NOT touch the tile edge layer
- On unmount: remove all 8 sources/layers, clear refs

### h3-js dependency
```bash
npm install h3-js
```

---

## 4. TrafficLegend

Reads `submode` from `useMapState()` and `selectedHex` state (from `trips-hex-selected` window event).

### Rutas submode
Unchanged — shows the existing green P5/P50/P95 color ramp.

### Trips submode — general (no hex selected)
```
⬡  Región
──  Flujo de viajes
```
- Small hex outline icon (faint) + label
- Short purple line swatch + label

### Trips submode — hex selected
```
⬡  Región seleccionada
──  Flujos de entrada    (blue  #3b82f6)
──  Flujos de salida     (amber #f59e0b)
```
Legend transitions when `trips-hex-selected` event fires. Click elsewhere → reverts to general legend.

---

## 5. MapFilters + TrafficStats

### MapFilters
```ts
VIZ_SUBMODES[MAP_MODES.TRAFFIC] = {
  items: [
    { id: 'rutas',  label: 'Rutas'          },
    { id: 'trips',  label: 'Origen-Destino' },
  ],
  // no requiresEdge
}
DEFAULT_SUBMODE[MAP_MODES.TRAFFIC] = 'rutas';
```

### TrafficStats
- **Generación** card: always active (affects both submodes)
- **Enrutamiento** card: always rendered, but `opacity: 0.4` + all buttons `disabled` + small label "No aplica en Origen-Destino" when `submode === 'trips'`
- **Período** dropdown: always active (filters both routes and trips)

---

## 6. Backend Changes

### get_od_hex_flows — auto threshold + period filter

**New signature:**
```python
def get_od_hex_flows(
    conn,
    city_id: int,
    generation_type: str,
    period: str | None = None,      # NEW: YYYY-MM filter
    resolution: int = 8,
    min_trips: int | None = None,   # None → auto-compute
) -> dict:
```

**Period filter added to SQL:**

The `trips` table has `datetime_unlock TIMESTAMP` but no explicit `metric_month` column. Two paths depending on what ingestion writes:

- **If synthetic trips have `datetime_unlock` set to any date within their month** (common pattern): filter with `DATE_TRUNC('month', t.datetime_unlock) = %s::date`
- **If `datetime_unlock` is NULL for generated trips**: add a `metric_month DATE` column to the `trips` table and populate it during ingestion.

Verify before implementing by inspecting a few generated trip rows: `SELECT datetime_unlock FROM trips WHERE generation_type != 'real' LIMIT 5;`

```sql
WHERE t.city_id = %s
  AND t.generation_type = %s
  AND (%s IS NULL OR DATE_TRUNC('month', t.datetime_unlock) = %s::date)
```

**Auto threshold:**
```python
if min_trips is None:
    total = sum(hex_counts.values())
    num_origins = len({oh for oh, _ in hex_counts})
    min_trips = max(1, total // (num_origins * 5))
```

### API route update
`GET /cities/{city_id}/trips/od-flows` gains optional `period` query param. Passes through to `get_od_hex_flows`.

### Frontend fetchODFlows update
```ts
export const fetchODFlows = async (
  cityId: number,
  generationType: string,
  period?: string,
  resolution: number = 8,
): Promise<GeoJSON.FeatureCollection>
```
`min_trips` param removed from frontend entirely.

---

## 7. Files Changed / Created / Deleted

| File | Action |
|---|---|
| `frontend/src/components/city/map/modes/traffic/TrafficLayer.tsx` | Rename → `TrafficRoutesLayer.tsx`, remove OD code, localise renderMode |
| `frontend/src/components/city/map/modes/traffic/TrafficModeLayer.tsx` | **Create** — thin wrapper that branches on submode |
| `frontend/src/components/city/map/modes/traffic/TrafficTripsLayer.tsx` | **Create** |
| `frontend/src/components/city/map/modes/traffic/TrafficModeSelectors.tsx` | **Delete** |
| `frontend/src/components/city/map/modes/traffic/TrafficLegend.tsx` | Update — submode-conditional content, remove TrafficModeSelectors import |
| `frontend/src/components/city/map/modes/index.ts` | Update submodes, import new layer |
| `frontend/src/components/city/map/CityLegend.tsx` | Remove traffic exclusion, update SUBMODE_LABELS |
| `frontend/src/components/city/MapFilters.tsx` | Update VIZ_SUBMODES.traffic |
| `frontend/src/components/city/map/modes/traffic/TrafficStats.tsx` | Grey out Enrutamiento card in trips submode |
| `frontend/src/services/api.ts` | Update `fetchODFlows` signature (add period, remove min_trips) |
| `backend/database/db_io/trips.py` | Add period filter + auto min_trips to `get_od_hex_flows` |
| `backend/api/routes.py` | Add `period` param to od-flows route |
| `frontend/package.json` | Add `h3-js` |
