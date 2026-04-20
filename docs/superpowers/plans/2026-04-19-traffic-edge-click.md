# Traffic Mode — Edge Click & Route Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user clicks a road segment in traffic mode, highlight it and draw all complete routes that pass through it — either as individual semi-transparent amber traces, or as an origin-destination viridis heatmap, toggled from the legend.

**Architecture:** A new backend endpoint reconstructs per-route geometry from `route_edges → edges` and returns it as GeoJSON. `TrafficLayer.tsx` gains click handling and dynamic GeoJSON overlay sources (mirroring the `StationsLayer` pattern). `TrafficLegend.tsx` gains a TRAZAS | CALOR submode pill (same pattern as `StationsLegend`).

**Tech Stack:** FastAPI + PostGIS (backend), React + MapLibre GL JS (frontend), TypeScript.

---

## File Map

| Action | Path | What changes |
|--------|------|--------------|
| Create | `backend/database/db_io/edge_routes.py` | Two DB query functions |
| Modify | `backend/database/db_io/__init__.py` | Export new functions |
| Modify | `backend/api/models.py` | Add `EdgeRoutesResponse` |
| Modify | `backend/api/routes.py` | Add `GET /cities/{city_id}/edges/{edge_id}/routes` |
| Create | `backend/tests/test_edge_routes.py` | Backend tests |
| Modify | `frontend/src/services/api.ts` | Add `fetchEdgeRoutes` |
| Modify | `frontend/src/components/city/map/modes/index.ts` | Add submodes to traffic |
| Modify | `frontend/src/components/city/map/CityCanvas.tsx` | Add `selected` feature-state to traffic-layer paint |
| Modify | `frontend/src/components/city/map/modes/traffic/TrafficLegend.tsx` | Add TRAZAS \| CALOR toggle |
| Modify | `frontend/src/components/city/map/modes/traffic/TrafficLayer.tsx` | Click handling, overlay, popup |

---

## Task 1: DB query functions

**Files:**
- Create: `backend/database/db_io/edge_routes.py`
- Modify: `backend/database/db_io/__init__.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_edge_routes.py`:

```python
"""Tests for edge route queries."""
import pytest
import json
from backend.database.db_io import get_all_cities, get_edge_route_traces, get_edge_route_od
from backend.database.db_io import get_paginated_edges


def _get_test_edge_id(conn):
    """Return an edge_id that has at least one route, or None."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT edge_id FROM route_edges LIMIT 1"
        )
        row = cur.fetchone()
        return row[0] if row else None


def test_get_edge_route_traces_returns_list(db_connection):
    edge_id = _get_test_edge_id(db_connection)
    if edge_id is None:
        pytest.skip("No route_edges in DB")
    cities = get_all_cities(db_connection)
    city_id = cities[0][0]
    result = get_edge_route_traces(db_connection, city_id, edge_id, limit=10)
    assert isinstance(result, list)
    for geom_str in result:
        geom = json.loads(geom_str)
        assert geom["type"] in ("LineString", "MultiLineString")


def test_get_edge_route_od_returns_pairs(db_connection):
    edge_id = _get_test_edge_id(db_connection)
    if edge_id is None:
        pytest.skip("No route_edges in DB")
    cities = get_all_cities(db_connection)
    city_id = cities[0][0]
    result = get_edge_route_od(db_connection, city_id, edge_id, limit=10)
    assert isinstance(result, list)
    for row in result:
        assert "origin_lon" in row
        assert "origin_lat" in row
        assert "dest_lon" in row
        assert "dest_lat" in row
        assert -180 <= row["origin_lon"] <= 180
        assert -90  <= row["origin_lat"] <= 90


def test_get_edge_route_traces_respects_limit(db_connection):
    edge_id = _get_test_edge_id(db_connection)
    if edge_id is None:
        pytest.skip("No route_edges in DB")
    cities = get_all_cities(db_connection)
    city_id = cities[0][0]
    result = get_edge_route_traces(db_connection, city_id, edge_id, limit=2)
    assert len(result) <= 2


def test_get_edge_route_traces_unknown_edge_returns_empty(db_connection):
    cities = get_all_cities(db_connection)
    city_id = cities[0][0]
    result = get_edge_route_traces(db_connection, city_id, edge_id=999999999, limit=10)
    assert result == []
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/alvarodelser/Projects/BikesForCities-webapp
python -m pytest backend/tests/test_edge_routes.py -v 2>&1 | head -30
```

Expected: `ImportError: cannot import name 'get_edge_route_traces'`

- [ ] **Step 3: Create `backend/database/db_io/edge_routes.py`**

```python
"""
edge_routes.py – queries for routes passing through a specific edge.
"""
from typing import List, Dict, Any


def get_edge_route_traces(
    conn,
    city_id: int,
    edge_id: int,
    limit: int = 500,
) -> List[str]:
    """Return GeoJSON geometry strings (LineString or MultiLineString) for
    all routes in city_id that pass through edge_id, up to limit routes.

    Uses ST_LineMerge(ST_Collect(geom)) to merge ordered edge segments into a
    single LineString per route where the edges are topologically connected.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ST_AsGeoJSON(ST_LineMerge(ST_Collect(geom))) AS geom
            FROM (
                SELECT re.route_id, e.geom
                FROM route_edges re
                JOIN edges e ON e.id = re.edge_id
                JOIN routes r ON r.id = re.route_id
                WHERE re.route_id IN (
                    SELECT DISTINCT route_id
                    FROM route_edges
                    WHERE edge_id = %(edge_id)s
                )
                AND r.city_id = %(city_id)s
                ORDER BY re.route_id, re.edge_order
            ) sub
            GROUP BY route_id
            LIMIT %(limit)s
            """,
            {"edge_id": edge_id, "city_id": city_id, "limit": limit},
        )
        return [row[0] for row in cur.fetchall() if row[0] is not None]


def get_edge_route_od(
    conn,
    city_id: int,
    edge_id: int,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    """Return origin and destination lat/lon for each route passing through
    edge_id in city_id, up to limit routes.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                n_o.lon AS origin_lon, n_o.lat AS origin_lat,
                n_d.lon AS dest_lon,   n_d.lat AS dest_lat
            FROM routes r
            JOIN nodes n_o ON n_o.id = r.origin_node
            JOIN nodes n_d ON n_d.id = r.dest_node
            WHERE r.city_id = %(city_id)s
              AND r.id IN (
                SELECT DISTINCT route_id
                FROM route_edges
                WHERE edge_id = %(edge_id)s
              )
            LIMIT %(limit)s
            """,
            {"city_id": city_id, "edge_id": edge_id, "limit": limit},
        )
        cols = ("origin_lon", "origin_lat", "dest_lon", "dest_lat")
        return [dict(zip(cols, row)) for row in cur.fetchall()]
```

- [ ] **Step 4: Export from `backend/database/db_io/__init__.py`**

Add to the `from .traffic import (...)` block (after the traffic imports):

```python
from .edge_routes import (
    get_edge_route_traces,
    get_edge_route_od,
)
```

Also add to `__all__`:
```python
    # edge routes
    "get_edge_route_traces", "get_edge_route_od",
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
python -m pytest backend/tests/test_edge_routes.py -v
```

Expected: all 4 tests PASS (or SKIP if DB has no routes).

- [ ] **Step 6: Commit**

```bash
git add backend/database/db_io/edge_routes.py backend/database/db_io/__init__.py backend/tests/test_edge_routes.py
git commit -m "feat: add get_edge_route_traces and get_edge_route_od DB functions"
```

---

## Task 2: Backend endpoint

**Files:**
- Modify: `backend/api/models.py`
- Modify: `backend/api/routes.py`

- [ ] **Step 1: Add `EdgeRoutesResponse` to `backend/api/models.py`**

Append after the existing `TrafficResponse` class (around line 195 in the file):

```python
class EdgeRoutesResponse(BaseResponse):
    """Response model for routes passing through a specific edge."""
    data: Dict[str, Any]   # GeoJSON FeatureCollection
    count: int
```

(The `Dict` and `Any` imports are already present at the top of the file.)

- [ ] **Step 2: Add endpoint to `backend/api/routes.py`**

Add the following import to the top-of-file imports block (add `EdgeRoutesResponse` to the models import list and add `get_edge_route_traces`, `get_edge_route_od` to the db_io import):

```python
# In the models import — add EdgeRoutesResponse:
from .models import (
    ...
    EdgeRoutesResponse,
)

# In the db_io import — add:
from backend.database.db_io import (
    ...
    get_edge_route_traces,
    get_edge_route_od,
)
```

Then append this route after the existing traffic endpoint (after line ~621):

```python
@router.get("/cities/{city_id}/edges/{edge_id}/routes", response_model=EdgeRoutesResponse)
async def get_edge_routes(
    city_id: int,
    edge_id: int,
    mode: str = Query("traces", description="Visualisation mode: traces or heatmap"),
    limit: int = Query(500, ge=1, le=1000, description="Max routes to return"),
    conn=Depends(get_db_connection),
):
    """Return routes passing through a specific edge as GeoJSON.

    mode=traces  → FeatureCollection of LineString geometries (one per route).
    mode=heatmap → FeatureCollection of Point geometries (origin + dest per route).
    """
    try:
        validate_network_exists(conn, city_id)

        # Verify the edge belongs to this city
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM edges WHERE id = %s AND city_id = %s",
                (edge_id, city_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Edge not found in this city")

        if mode == "heatmap":
            rows = get_edge_route_od(conn, city_id, edge_id, limit=limit)
            features = []
            for row in rows:
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [row["origin_lon"], row["origin_lat"]]},
                    "properties": {"kind": "origin"},
                })
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [row["dest_lon"], row["dest_lat"]]},
                    "properties": {"kind": "destination"},
                })
            count = len(rows)
        else:
            geom_strings = get_edge_route_traces(conn, city_id, edge_id, limit=limit)
            import json as _json
            features = [
                {"type": "Feature", "geometry": _json.loads(g), "properties": {}}
                for g in geom_strings
            ]
            count = len(features)

        feature_collection = {
            "type": "FeatureCollection",
            "features": features,
        }

        return EdgeRoutesResponse(
            data=feature_collection,
            count=count,
            message=f"{count} routes found for edge {edge_id}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting routes for edge {edge_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve edge routes")
```

- [ ] **Step 3: Smoke-test the endpoint**

With the backend running (`uvicorn backend.api.main:app --reload`), run:

```bash
# Replace CITY_ID and EDGE_ID with real values from your DB
curl -s "http://localhost:8000/api/cities/1/edges/1/routes?mode=traces&limit=5" | python3 -m json.tool | head -30
```

Expected: JSON with `"type": "FeatureCollection"` and a `count` field.

```bash
# Heatmap mode
curl -s "http://localhost:8000/api/cities/1/edges/1/routes?mode=heatmap&limit=5" | python3 -m json.tool | head -30
```

Expected: JSON where every feature has `"type": "Point"`.

```bash
# Unknown edge
curl -s "http://localhost:8000/api/cities/1/edges/999999/routes" | python3 -m json.tool
```

Expected: `{"detail": "Edge not found in this city"}` with HTTP 404.

- [ ] **Step 4: Commit**

```bash
git add backend/api/models.py backend/api/routes.py
git commit -m "feat: add GET /cities/{city_id}/edges/{edge_id}/routes endpoint"
```

---

## Task 3: Frontend API client

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add `fetchEdgeRoutes` to `frontend/src/services/api.ts`**

Append after the existing `fetchTraffic` function:

```typescript
export const fetchEdgeRoutes = async (
    cityId: number,
    edgeId: number,
    mode: 'traces' | 'heatmap' = 'traces',
    limit: number = 500,
): Promise<{ data: GeoJSON.FeatureCollection; count: number }> => {
    const response = await fetch(
        `${API_BASE_URL}/cities/${cityId}/edges/${edgeId}/routes?mode=${mode}&limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to fetch edge routes');
    return await response.json();
};
```

The `GeoJSON` namespace is available from `@types/geojson` — add this import at the top of `api.ts` if not already present:

```typescript
import type * as GeoJSON from 'geojson';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/alvarodelser/Projects/BikesForCities-webapp/frontend
npx tsc --noEmit 2>&1 | grep -i "api.ts" | head -10
```

Expected: no errors from `api.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add fetchEdgeRoutes API client function"
```

---

## Task 4: Modes config — add submodes to traffic

**Files:**
- Modify: `frontend/src/components/city/map/modes/index.ts`

- [ ] **Step 1: Update the traffic entry**

In `frontend/src/components/city/map/modes/index.ts`, replace:

```typescript
    traffic: {
        layer:          TrafficLayer,
        legend:         TrafficLegend,
        submodes:       [],
        defaultSubmode: '',
    },
```

with:

```typescript
    traffic: {
        layer:          TrafficLayer,
        legend:         TrafficLegend,
        submodes:       ['traces', 'heatmap'],
        defaultSubmode: 'traces',
    },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/alvarodelser/Projects/BikesForCities-webapp/frontend
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/city/map/modes/index.ts
git commit -m "feat: add traces/heatmap submodes to traffic mode config"
```

---

## Task 5: CityCanvas — selected edge highlight

**Files:**
- Modify: `frontend/src/components/city/map/CityCanvas.tsx`

- [ ] **Step 1: Update the `traffic-layer` paint expression**

In `CityCanvas.tsx`, locate the `traffic-layer` `addLayer` call (around line 139). Replace the `paint` object with one that checks `feature-state.selected` first:

```typescript
                paint: {
                    'line-width': [
                        'case',
                        ['==', ['feature-state', 'selected'], true], 5,
                        3,
                    ],
                    'line-color': [
                        'case',
                        ['==', ['feature-state', 'selected'], true], '#f0c040',
                        ['!=', ['feature-state', 'trip_count'], null],
                        [
                            'interpolate', ['linear'], ['feature-state', 'trip_count'],
                            0, '#edf8e9', 10, '#c7e9c0', 50, '#a1d99b', 100, '#74c476',
                            500, '#41ab5d', 1000, '#238b45', 5000, '#005a32',
                        ],
                        '#edf8e9',
                    ],
                },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/alvarodelser/Projects/BikesForCities-webapp/frontend
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/city/map/CityCanvas.tsx
git commit -m "feat: add selected feature-state highlight to traffic-layer paint"
```

---

## Task 6: TrafficLegend — TRAZAS | CALOR toggle

**Files:**
- Modify: `frontend/src/components/city/map/modes/traffic/TrafficLegend.tsx`

- [ ] **Step 1: Replace the full file content**

`TrafficLegend.tsx` currently has no toggle. Replace the entire file:

```typescript
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';

export default function TrafficLegend() {
    const { thresholds } = useThresholds();
    const { submode, setSubmode } = useMapState();
    const mode = submode === 'heatmap' ? 'heatmap' : 'traces';

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex flex-col gap-3 border-b border-black/5 pb-3 mb-2 font-[Archivo_Narrow]">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-black/60 uppercase tracking-widest leading-tight">
                        Viajes por Calle
                    </span>
                    <div className="flex p-0.5 bg-black/5 rounded-lg">
                        <button
                            onClick={() => setSubmode('traces')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${mode === 'traces' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/60'}`}
                        >
                            TRAZAS
                        </button>
                        <button
                            onClick={() => setSubmode('heatmap')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${mode === 'heatmap' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/60'}`}
                        >
                            CALOR
                        </button>
                    </div>
                </div>
                <span className="text-[10px] font-medium text-black/40 italic">
                    (viajes estimados / mes — clic en tramo para rutas)
                </span>
            </div>

            <div className="flex gap-4 h-64 my-2 relative">
                <div className="flex flex-col w-4 h-full rounded-full overflow-hidden border border-black/10 shadow-sm">
                    <div
                        className="flex-1 w-full"
                        style={{
                            background: 'linear-gradient(to top, #edf8e9, #c7e9c0, #a1d99b, #74c476, #41ab5d, #238b45, #005a32)'
                        }}
                    />
                </div>

                <div className="flex-1 relative h-full text-[10px] font-bold text-black/60 tracking-tight">
                    <div className="absolute top-0 flex items-center h-4">
                        <span className="opacity-40">{thresholds?.max != null ? Math.round(thresholds.max) : '–'} v/m</span>
                    </div>
                    <div className="absolute top-10 flex items-center w-full h-0">
                        <div className="flex items-center gap-1.5 w-full">
                            <div className="w-2 h-[1.5px] bg-black/10" />
                            <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                {thresholds?.q95 != null ? Math.round(thresholds.q95) : '–'} v/m (P95)
                            </span>
                        </div>
                    </div>
                    <div className="absolute top-1/2 flex items-center w-full h-0 -translate-y-1/2">
                        <div className="flex items-center gap-1.5 w-full">
                            <div className="w-4 h-[1.5px] bg-black/20" />
                            <span className="px-2 py-1 rounded-md border shadow-md backdrop-blur-md whitespace-nowrap bg-green-100/90 text-black/80 border-green-200/60">
                                {thresholds?.q50 != null ? Math.round(thresholds.q50) : '–'} v/m (mediana)
                            </span>
                        </div>
                    </div>
                    <div className="absolute bottom-10 flex items-center w-full h-0">
                        <div className="flex items-center gap-1.5 w-full">
                            <div className="w-2 h-[1.5px] bg-black/10" />
                            <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                {thresholds?.q5 != null ? Math.round(thresholds.q5) : '–'} v/m (P5)
                            </span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 flex items-center h-4">
                        <span className="opacity-40">{thresholds?.min != null ? Math.round(thresholds.min) : '–'} v/m</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/alvarodelser/Projects/BikesForCities-webapp/frontend
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/city/map/modes/traffic/TrafficLegend.tsx
git commit -m "feat: add TRAZAS/CALOR submode toggle to TrafficLegend"
```

---

## Task 7: TrafficLayer — click handling, popup, overlay

**Files:**
- Modify: `frontend/src/components/city/map/modes/traffic/TrafficLayer.tsx`

- [ ] **Step 1: Replace the full file content**

```typescript
import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useThresholds } from '../../ThresholdsContext';
import { fetchTraffic, fetchEdgeRoutes } from '../../../../../services/api';

const LAYER_ID      = 'traffic-layer';
const SOURCE_ID     = 'edges-source';
const TRACES_SOURCE = 'route-traces-source';
const TRACES_LAYER  = 'route-traces-layer';
const OD_SOURCE     = 'route-od-source';
const OD_LAYER      = 'route-od-layer';

interface TrafficLayerProps {
    submode: string;
}

// ---- DOM popup builder ----
function buildEdgePopupDOM(
    edgeName: string | null,
    tripCount: number | null,
    onClose: () => void,
): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = "font-family:'Archivo Narrow',sans-serif;padding:2px;min-width:150px;";

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;';

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-size:12px;font-weight:700;color:#1a202c;';
    nameSpan.textContent = edgeName ?? 'Tramo sin nombre';
    header.appendChild(nameSpan);

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'cursor:pointer;color:rgba(0,0,0,0.3);font-size:11px;flex-shrink:0;';
    closeBtn.onclick = (ev) => { ev.stopPropagation(); onClose(); };
    header.appendChild(closeBtn);
    container.appendChild(header);

    const badge = document.createElement('div');
    badge.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:5px;font-size:12px;font-weight:800;background:#238b45;color:white;';
    if (tripCount != null) {
        badge.innerHTML = `${Math.round(tripCount)} <span style="font-size:10px;font-weight:500;opacity:0.85;">v/mes</span>`;
    } else {
        badge.innerHTML = '<span style="font-size:10px;font-weight:500;">Sin datos</span>';
    }
    container.appendChild(badge);

    const routeInfo = document.createElement('div');
    routeInfo.dataset.routeInfo = 'true';
    routeInfo.style.cssText = 'margin-top:6px;font-size:10px;color:rgba(0,0,0,0.4);';
    routeInfo.textContent = 'Cargando rutas\u2026';
    container.appendChild(routeInfo);

    return container;
}

export default function TrafficLayer({ submode }: TrafficLayerProps) {
    const { map, city } = useMap();
    const { setThresholds } = useThresholds();

    const popupRef   = useRef<maplibregl.Popup | null>(null);
    const stickyRef  = useRef<{ edgeId: number; lngLat: maplibregl.LngLat } | null>(null);
    const submodeRef = useRef<string>(submode);

    useEffect(() => { submodeRef.current = submode; }, [submode]);

    // --- Overlay helpers ---
    const clearOverlay = useCallback(() => {
        if (!map) return;
        if (map.getLayer(TRACES_LAYER))  map.removeLayer(TRACES_LAYER);
        if (map.getSource(TRACES_SOURCE)) map.removeSource(TRACES_SOURCE);
        if (map.getLayer(OD_LAYER))      map.removeLayer(OD_LAYER);
        if (map.getSource(OD_SOURCE))    map.removeSource(OD_SOURCE);
    }, [map]);

    const renderOverlay = useCallback((geojson: GeoJSON.FeatureCollection, mode: string) => {
        if (!map) return;
        clearOverlay();
        if (mode === 'heatmap') {
            map.addSource(OD_SOURCE, { type: 'geojson', data: geojson });
            map.addLayer({
                id: OD_LAYER,
                type: 'heatmap',
                source: OD_SOURCE,
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
        } else {
            map.addSource(TRACES_SOURCE, { type: 'geojson', data: geojson });
            map.addLayer({
                id: TRACES_LAYER,
                type: 'line',
                source: TRACES_SOURCE,
                paint: {
                    'line-color': '#f59e0b',
                    'line-width': 1.5,
                    'line-opacity': 0.28,
                },
            });
        }
    }, [map, clearOverlay]);

    const doDeselect = useCallback(() => {
        if (!map || !stickyRef.current) return;
        map.setFeatureState(
            { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
            { selected: false }
        );
        stickyRef.current = null;
        popupRef.current?.remove();
        clearOverlay();
    }, [map, clearOverlay]);

    const loadRoutes = useCallback(async (
        edgeId: number,
        mode: string,
        routeInfoEl: HTMLElement | null,
    ) => {
        if (!city?.id) return;
        try {
            const result = await fetchEdgeRoutes(city.id, edgeId, mode as 'traces' | 'heatmap');
            // Bail if the user has already moved to a different edge
            if (!stickyRef.current || stickyRef.current.edgeId !== edgeId) return;
            if (routeInfoEl) {
                routeInfoEl.textContent = result.count > 0
                    ? `${result.count} rutas`
                    : 'Sin rutas registradas';
            }
            if (result.count > 0) renderOverlay(result.data, mode);
        } catch (err) {
            console.error('Failed to fetch edge routes:', err);
            if (routeInfoEl) routeInfoEl.textContent = '';
        }
    }, [city?.id, renderOverlay]);

    // --- Mount: show layer, hide others ---
    useEffect(() => {
        if (!map) return;
        if (map.getLayer(LAYER_ID))           map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        if (map.getLayer('stations-layer'))   map.setLayoutProperty('stations-layer', 'visibility', 'none');
        if (map.getLayer('bike-paths-layer')) map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');
        return () => {
            if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
            clearOverlay();
            popupRef.current?.remove();
            if (stickyRef.current) {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
                    { selected: false }
                );
                stickyRef.current = null;
            }
            setThresholds(null);
        };
    }, [map]);

    // --- Data fetch: traffic counts ---
    useEffect(() => {
        if (!map || !city?.id) return;
        let cancelled = false;
        fetchTraffic(city.id).then(trafficData => {
            if (cancelled || !map) return;
            trafficData.forEach(t => {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: t.edge_id },
                    { trip_count: t.trip_count }
                );
            });
            const counts = trafficData.map(t => t.trip_count).sort((a, b) => a - b);
            if (counts.length > 0) {
                setThresholds({
                    q5:  counts[Math.floor(counts.length * 0.05)],
                    q50: counts[Math.floor(counts.length * 0.5)],
                    q95: counts[Math.floor(counts.length * 0.95)],
                    max: Math.max(...counts),
                    min: Math.min(...counts),
                });
            }
        }).catch(err => console.error('Failed to load traffic:', err));
        return () => { cancelled = true; };
    }, [map, city?.id]);

    // --- Click handling ---
    useEffect(() => {
        if (!map) return;

        const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: '200px',
        });
        popupRef.current = popup;

        const onMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
        const onMouseLeave = () => { map.getCanvas().style.cursor = ''; };

        const onClick = (e: maplibregl.MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            if (!feature) return;

            const edgeId = feature.id as number;
            if (stickyRef.current?.edgeId === edgeId) return; // no-op: same edge

            // Deselect previous
            if (stickyRef.current) {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
                    { selected: false }
                );
                clearOverlay();
                popup.remove();
            }

            const edgeName = (feature.properties?.name as string | undefined) ?? null;
            const state = map.getFeatureState({ source: SOURCE_ID, sourceLayer: 'edges', id: edgeId });
            const tripCount = (state?.trip_count as number | undefined) ?? null;

            map.setFeatureState(
                { source: SOURCE_ID, sourceLayer: 'edges', id: edgeId },
                { selected: true }
            );
            stickyRef.current = { edgeId, lngLat: e.lngLat };

            const dom = buildEdgePopupDOM(edgeName, tripCount, () => doDeselect());
            popup.setLngLat(e.lngLat).setDOMContent(dom).addTo(map);

            const routeInfoEl = dom.querySelector<HTMLElement>('[data-route-info]');
            loadRoutes(edgeId, submodeRef.current, routeInfoEl);
        };

        const onMapClick = (e: maplibregl.MapMouseEvent) => {
            if (!stickyRef.current) return;
            const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
            if (!hits?.length) doDeselect();
        };

        map.on('mouseenter', LAYER_ID, onMouseEnter);
        map.on('mouseleave', LAYER_ID, onMouseLeave);
        map.on('click',      LAYER_ID, onClick);
        map.on('click',               onMapClick);

        return () => {
            map.off('mouseenter', LAYER_ID, onMouseEnter);
            map.off('mouseleave', LAYER_ID, onMouseLeave);
            map.off('click',      LAYER_ID, onClick);
            map.off('click',               onMapClick);
            popup.remove();
        };
    }, [map, loadRoutes, clearOverlay, doDeselect]);

    // --- Submode change: re-fetch overlay if an edge is selected ---
    useEffect(() => {
        if (!stickyRef.current) return;
        clearOverlay();
        // Update the popup's route info line
        const routeInfoEl = document.querySelector<HTMLElement>('[data-route-info]');
        if (routeInfoEl) routeInfoEl.textContent = 'Cargando rutas\u2026';
        loadRoutes(stickyRef.current.edgeId, submode, routeInfoEl ?? null);
    }, [submode]); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
cd /Users/alvarodelser/Projects/BikesForCities-webapp/frontend
npx tsc --noEmit 2>&1
```

Expected: zero errors. Fix any TypeScript errors before proceeding (common: `GeoJSON` namespace not imported in `api.ts` — see Task 3).

- [ ] **Step 3: Start dev server and smoke-test**

```bash
cd /Users/alvarodelser/Projects/BikesForCities-webapp/frontend
npm run dev
```

Open a city in traffic mode. Verify:
1. Legend shows TRAZAS | CALOR toggle.
2. Cursor changes to pointer on hover over any road.
3. Clicking a road highlights it yellow and shows a popup with the street name (or "Tramo sin nombre") and trip count.
4. Clicking empty space deselects and removes the popup.
5. Clicking a different road switches selection correctly.
6. Toggling TRAZAS ↔ CALOR in the legend while a road is selected triggers a new fetch and clears the previous overlay.
7. If the backend has route data: traces appear as amber semi-transparent lines; heatmap appears as a viridis density map.
8. If the backend has no route data: popup shows the trip count and "Sin rutas registradas"; no overlay is drawn.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/city/map/modes/traffic/TrafficLayer.tsx
git commit -m "feat: add edge click, route overlay, and popup to TrafficLayer"
```
