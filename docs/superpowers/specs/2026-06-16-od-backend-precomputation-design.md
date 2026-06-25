# O-D Flow Backend Precomputation

**Date:** 2026-06-16  
**Status:** Approved

## Problem

The O-D visualization currently runs Force-Directed Edge Bundling (FDEB) in the browser on every page load. This caps bundled pairs at 500, blocks the main thread for several seconds on large cities, and re-computes the same result every time the default (latest) view is loaded.

## Goals

- Precompute FDEB + Chaikin-smoothed O-D flows at ingest time, stored in Postgres
- Serve precomputed results instantly for the default (latest month) view
- Fall back to the existing on-demand path for historical period selections
- Improve visual quality: sharper accumulation coloring, tighter bundling parameters, applied to both paths

## Non-Goals

- Precomputing historical periods or date ranges
- Per-city configurable pair limits (5,000 is the fixed default)
- Replacing the GPU accumulation layer (`ODAccumulationLayer`)

---

## Architecture

### Data flow — default (latest month)

```
Ingest pipeline
  └─ upsert_edge_traffic_for_city()
       └─ compute_od_bundled_flows()   [backend/processing/od_bundling.py]
            ├─ get_latest_traffic_month() → month
            ├─ get_od_hex_flows() → raw H3 straight-line features
            ├─ undirected aggregation → top 5,000 pairs by count
            ├─ run_fdeb()              [K=0.4, I0=50, P0=8, cycles=4, thresh=0.60]
            ├─ chaikin_smooth()        [2 passes]
            └─ upsert → od_bundled_flows (JSONB + month)

GET /cities/{id}/trips/od-flows  (no period param)
  └─ od_bundled_flows → FeatureCollection → response  (~instant)

Frontend
  └─ features[0].coordinates.length > 2 → skip FDEB, render directly
```

### Data flow — historical period fallback

```
GET /cities/{id}/trips/od-flows?period=2024-03
  └─ no matching precomputed row → get_od_hex_flows() (straight-line, 2-point)

Frontend
  └─ features[0].coordinates.length === 2 → run FDEB (JS, top 500 pairs, as today)
```

The frontend detects which path was taken by inspecting `coordinates.length` on the first feature. No new API contract or response flag needed. Both paths feed into the same `ODAccumulationLayer.setData()`, so all visual changes apply to both automatically.

---

## Database Schema

**New migration: `023_od_bundled_flows.sql`**

```sql
CREATE TABLE od_bundled_flows (
    id              SERIAL PRIMARY KEY,
    city_id         INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    generation_type TEXT    NOT NULL,
    month           DATE    NOT NULL,
    resolution      INTEGER NOT NULL DEFAULT 9,
    pair_limit      INTEGER NOT NULL DEFAULT 5000,
    geojson         JSONB   NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (city_id, generation_type, resolution)
);

CREATE INDEX od_bundled_flows_lookup
    ON od_bundled_flows (city_id, generation_type, month);
```

`UNIQUE (city_id, generation_type, resolution)` — each upsert replaces the previous row. No history is kept; always the latest bundled result. The `month` column records which traffic month the bundling was computed for.

---

## New Module: `backend/processing/od_bundling.py`

Public interface:

```python
def compute_od_bundled_flows(
    conn,
    city_id: int,
    generation_type: str,
    resolution: int = 9,
    pair_limit: int = 5000,
) -> None:
    """Compute and store bundled O-D flows for the latest month of the given generation_type."""
```

Internal steps:

1. `get_latest_traffic_month(conn, city_id, generation_type)` — resolve the month
2. `get_od_hex_flows(conn, city_id, generation_type, period=month, resolution=resolution)` — fetch all hex pairs (no pair cap at this stage; min_trips threshold still applies)
3. **Undirected aggregation** — merge A→B with B→A under canonical key `min|max`, sum counts
4. **Top N selection** — sort descending by count, take first `pair_limit`
5. **`run_fdeb(pairs, **fdeb_params)`** — Python port of the JS FDEB in `TrafficTripsLayer.tsx`, with updated parameters (see below)
6. **`chaikin_smooth(coords, iterations=2)`** — Python port of the JS version
7. Build GeoJSON FeatureCollection with properties: `orig_hex`, `dest_hex`, `count`, `log_weight`
8. Upsert into `od_bundled_flows` — replace existing row for `(city_id, generation_type, resolution)`

### FDEB parameters

| Parameter | Current JS | Updated (both Python + JS fallback) |
|-----------|-----------|--------------------------------------|
| `K` (spring constant) | 0.3 | **0.4** |
| `S0` (initial step size) | 0.002 | 0.002 |
| `I0` (initial iterations) | 40 | **50** |
| `P0` (initial subdivisions) | 6 | **8** |
| `cycles` | 3 | **4** |
| `compatThreshold` | 0.65 | **0.60** |

The JS fallback in `TrafficTripsLayer.tsx` is updated to use the same values so both paths produce visually consistent bundling.

---

## Updated API: `GET /cities/{id}/trips/od-flows`

**File:** `backend/api/routes.py`

New lookup logic before falling through to the existing on-demand path:

```python
# Try precomputed result (no period → latest; or period matches stored month)
bundled, stored_month = get_od_bundled_flows(conn, city_id, generation_type, resolution)
if bundled and period_from is None:
    if period is None:
        return bundled
    if stored_month and stored_month.strftime('%Y-%m') == period:
        return bundled

# Fallback: on-demand computation (straight-line features)
geojson = get_od_hex_flows(conn, city_id, generation_type, period=period,
                            resolution=resolution, period_from=period_from)
return geojson
```

**New read function in `backend/database/db_io/trips.py`:**

```python
def get_od_bundled_flows(conn, city_id, generation_type, resolution=9) -> tuple[dict | None, date | None]:
    """Return (geojson_dict, month) from od_bundled_flows, or (None, None) if not found."""
```

Exported from `backend/database/db_io/__init__.py`.

---

## Frontend Changes: `TrafficTripsLayer.tsx`

### Bundling detection (in `buildLayers`)

```typescript
const alreadyBundled =
    geojson.features.length > 0 &&
    (geojson.features[0].geometry as GeoJSON.LineString).coordinates.length > 2;

if (alreadyBundled) {
    // Precomputed: compute log_weight and pass directly to accumulation layer
    const maxCount = Math.max(...geojson.features.map(f => f.properties?.count ?? 1), 1);
    odFlowsRef.current = geojson.features.map(f => ({
        ...f,
        properties: {
            ...f.properties,
            log_weight: Math.log1p(f.properties?.count ?? 0) / Math.log1p(maxCount),
        },
    }));
} else {
    // Fallback: straight-line features → run FDEB (historical period)
    // ... existing undirected aggregation + runFDEB + chaikinSmooth logic ...
}
```

### Updated FDEB parameters in JS fallback

Match the Python values: `K=0.4, S0=0.002, I0=50, P0=8, cycles=4, compatThreshold=0.60`.

---

## Visual Changes: `ODAccumulationLayer.ts`

Both the precomputed and fallback paths render through `ODAccumulationLayer.setData()`, so these changes apply to both.

### Fragment shader (`FRAG_COMP`) — alpha function

**Current:**
```glsl
float a = clamp(sqrt(t) * u_opacity, 0.0, 1.0);
```

**Proposed:**
```glsl
float a = clamp(t * t * u_opacity, 0.0, 1.0);
```

`t²` vs `sqrt(t)`: faint stray lines nearly disappear; true bundles glow prominently. This is the most impactful visual change.

### Color ramp midpoint shift

**Current:** midpoint at `t=0.5` (purple)  
**Proposed:** shift midpoint to `t=0.35` so flows reach amber sooner:

```glsl
vec3 flowGradient(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 a = vec3(0.78, 0.73, 0.98);  // light indigo
    vec3 b = vec3(0.50, 0.08, 0.86);  // vivid purple
    vec3 c = vec3(0.96, 0.50, 0.08);  // warm amber
    float mid = 0.35;
    if (t < mid) return mix(a, b, t / mid);
    return mix(b, c, (t - mid) / (1.0 - mid));
}
```

### `maxCount` calculation

**Current:** `Math.max(10, Math.ceil(features.length * 0.15))`  
**Proposed:** derive from actual top pair count in the feature properties:

```typescript
const maxCount = Math.max(10, Math.ceil(
    Math.max(...features.map(f => f.properties?.count ?? 0)) * 0.08
));
```

A tighter ceiling against the real maximum (8th-percentile of top count) stretches the color range more aggressively.

---

## Ingest Integration

In `backend/database/db_io/traffic.py`, at the end of `upsert_edge_traffic_for_city()`, after `refresh_city_modes`:

```python
from backend.processing.od_bundling import compute_od_bundled_flows
try:
    compute_od_bundled_flows(conn, city_id, generation_type)
except Exception as e:
    print(f"   ⚠️  OD bundling failed (non-fatal): {e}")
```

Wrapped in try/except so a bundling failure never breaks the ingest pipeline.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/database/migrations/023_od_bundled_flows.sql` | New — schema |
| `backend/processing/od_bundling.py` | New — FDEB, Chaikin, compute+upsert |
| `backend/database/db_io/trips.py` | Add `get_od_bundled_flows()` |
| `backend/database/db_io/__init__.py` | Export `get_od_bundled_flows` |
| `backend/database/run_migrations.py` | Pick up new migration |
| `backend/api/routes.py` | Precomputed lookup before on-demand fallback |
| `frontend/src/components/city/map/modes/traffic/TrafficTripsLayer.tsx` | Bundling detection, updated FDEB params |
| `frontend/src/components/city/map/modes/traffic/ODAccumulationLayer.ts` | Shader + maxCount changes |
