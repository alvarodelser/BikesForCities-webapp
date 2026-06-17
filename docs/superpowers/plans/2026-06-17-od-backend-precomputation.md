# O-D Backend Precomputation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move O-D flow bundling (FDEB + Chaikin) to a Python backend module, precompute and store results for the latest month in Postgres, serve them instantly, and improve visual quality via shader tweaks.

**Architecture:** A new `backend/processing/od_bundling.py` module computes bundled flows at ingest time and upserts them into a new `od_bundled_flows` table. The `GET /trips/od-flows` API checks for a precomputed row first, falling through to on-demand straight-line computation for historical periods. The frontend detects bundled features via `coordinates.length > 2` and skips JS FDEB if already bundled. Visual changes to `ODAccumulationLayer.ts` apply to both paths.

**Tech Stack:** Python 3.9, psycopg2, h3, FastAPI, Postgres JSONB, TypeScript/React, WebGL2/GLSL, Vitest

---

### Task 1: Database migration — `od_bundled_flows` table

**Files:**
- Create: `backend/database/migrations/023_od_bundled_flows.sql`

- [ ] **Step 1: Create migration file**

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

- [ ] **Step 2: Run migration**

```bash
python backend/database/run_migrations.py
```

Expected output includes: `Successfully executed 023_od_bundled_flows.sql`

- [ ] **Step 3: Verify table exists**

```bash
python -c "
from backend.database.db_io import connect_db
conn = connect_db()
with conn.cursor() as cur:
    cur.execute(\"SELECT column_name FROM information_schema.columns WHERE table_name='od_bundled_flows' ORDER BY ordinal_position\")
    print([r[0] for r in cur.fetchall()])
conn.close()
"
```

Expected: `['id', 'city_id', 'generation_type', 'month', 'resolution', 'pair_limit', 'geojson', 'computed_at']`

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/023_od_bundled_flows.sql
git commit -m "feat: add od_bundled_flows table migration"
```

---

### Task 2: DB read function `get_od_bundled_flows`

**Files:**
- Create: `backend/tests/test_od_bundling.py`
- Modify: `backend/database/db_io/trips.py`
- Modify: `backend/database/db_io/__init__.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_od_bundling.py`:

```python
import json
import pytest
from datetime import date
from backend.database.db_io.cities import get_or_create_city
from backend.database.db_io.trips import get_od_bundled_flows


def test_get_od_bundled_flows_not_found(transactional_db):
    city_id = get_or_create_city(transactional_db, name="ODReadTestCity")
    result, month = get_od_bundled_flows(transactional_db, city_id, "station_based", resolution=9)
    assert result is None
    assert month is None


def test_get_od_bundled_flows_returns_stored(transactional_db):
    city_id = get_or_create_city(transactional_db, name="ODReadTestCity2")
    geojson = {"type": "FeatureCollection", "features": []}
    stored_month = date(2024, 3, 1)
    with transactional_db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO od_bundled_flows
                (city_id, generation_type, month, resolution, pair_limit, geojson)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            """,
            (city_id, "station_based", stored_month, 9, 5000, json.dumps(geojson)),
        )
    result, month = get_od_bundled_flows(transactional_db, city_id, "station_based", resolution=9)
    assert result == geojson
    assert month == stored_month
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest backend/tests/test_od_bundling.py -v
```

Expected: ImportError or AttributeError — `get_od_bundled_flows` does not exist yet.

- [ ] **Step 3: Add function to `backend/database/db_io/trips.py`**

Append after the closing `return` of `get_od_hex_flows` (after line ~285):

```python
def get_od_bundled_flows(
    conn,
    city_id: int,
    generation_type: str,
    resolution: int = 9,
) -> tuple:
    """Return (geojson_dict, month) from od_bundled_flows, or (None, None) if not found."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT geojson, month
            FROM od_bundled_flows
            WHERE city_id        = %s
              AND generation_type = %s
              AND resolution      = %s
            """,
            (city_id, generation_type, resolution),
        )
        row = cur.fetchone()
    if row is None:
        return None, None
    return row[0], row[1]
```

- [ ] **Step 4: Export from `backend/database/db_io/__init__.py`**

Find the `from .trips import (` block and add `get_od_bundled_flows`:

```python
from .trips import (
    put_trips,
    count_trips,
    count_unrouted_trips,
    get_unrouted_trip_groups,
    count_unsaferouted_trips,
    get_unsaferouted_trip_groups,
    city_has_real_trips,
    get_paginated_trips,
    get_trip_stats,
    get_od_hex_flows,
    get_od_bundled_flows,
)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
python -m pytest backend/tests/test_od_bundling.py -v
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/database/db_io/trips.py backend/database/db_io/__init__.py backend/tests/test_od_bundling.py
git commit -m "feat: add get_od_bundled_flows DB read function"
```

---

### Task 3: Backend pure functions — `run_fdeb` and `chaikin_smooth`

**Files:**
- Create: `backend/processing/od_bundling.py`
- Modify: `backend/tests/test_od_bundling.py`

- [ ] **Step 1: Append failing tests to `backend/tests/test_od_bundling.py`**

```python
from backend.processing.od_bundling import run_fdeb, chaikin_smooth


def test_chaikin_smooth_zero_iterations():
    pts = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0]]
    assert chaikin_smooth(pts, iterations=0) == pts


def test_chaikin_smooth_doubles_point_count():
    pts = [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0]]
    assert len(chaikin_smooth(pts, iterations=1)) == 6   # 2 * 3
    assert len(chaikin_smooth(pts, iterations=2)) == 12  # 4 * 3


def test_chaikin_smooth_preserves_endpoints():
    pts = [[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]]
    result = chaikin_smooth(pts, iterations=2)
    assert result[0] == pts[0]
    assert result[-1] == pts[-1]


def test_chaikin_smooth_correct_values():
    pts = [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0]]
    r = chaikin_smooth(pts, iterations=1)
    assert r[1] == [0.5, 0.0]   # 0.75*p0 + 0.25*p1
    assert r[2] == [1.5, 0.0]   # 0.25*p0 + 0.75*p1
    assert r[3] == [2.0, 0.5]   # 0.75*p1 + 0.25*p2
    assert r[4] == [2.0, 1.5]   # 0.25*p1 + 0.75*p2


def test_run_fdeb_empty():
    assert run_fdeb([]) == []


def test_run_fdeb_single_pair_structure():
    pairs = [{'orig': [0.0, 0.0], 'dest': [1.0, 0.0], 'count': 5}]
    result = run_fdeb(pairs)
    assert len(result) == 1
    assert result[0]['count'] == 5
    # P0=8, 4 cycles with 3 doublings: 8 → 16 → 32 → 64 → 65 points
    assert len(result[0]['coords']) == 65


def test_run_fdeb_parallel_edges_attract():
    """Two parallel edges must attract at their midpoints."""
    pairs = [
        {'orig': [0.0, 0.0], 'dest': [1.0, 0.0], 'count': 10},
        {'orig': [0.0, 0.2], 'dest': [1.0, 0.2], 'count': 10},
    ]
    result = run_fdeb(pairs)
    mid = len(result[0]['coords']) // 2
    assert result[0]['coords'][mid][1] > 0.0    # edge at y=0 moves up
    assert result[1]['coords'][mid][1] < 0.2    # edge at y=0.2 moves down
```

- [ ] **Step 2: Run to verify failure**

```bash
python -m pytest backend/tests/test_od_bundling.py -v -k "chaikin or fdeb"
```

Expected: ImportError — `backend.processing.od_bundling` does not exist.

- [ ] **Step 3: Create `backend/processing/od_bundling.py`**

```python
"""od_bundling.py — FDEB + Chaikin precomputation for O-D flows."""
import json
import math
from datetime import date
from typing import List, Dict, Optional

from backend.database.db_io.traffic import get_latest_traffic_month
from backend.database.db_io.trips import get_od_hex_flows


def _fdeb_compatibility(p0: list, p1: list, q0: list, q1: list) -> float:
    px, py = p1[0] - p0[0], p1[1] - p0[1]
    qx, qy = q1[0] - q0[0], q1[1] - q0[1]
    lp = math.sqrt(px * px + py * py)
    lq = math.sqrt(qx * qx + qy * qy)
    if lp < 1e-9 or lq < 1e-9:
        return 0.0
    ca = abs((px * qx + py * qy) / (lp * lq))
    lavg = (lp + lq) / 2.0
    cs = 2.0 / (lavg / min(lp, lq) + max(lp, lq) / lavg)
    mpx, mpy = (p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0
    mqx, mqy = (q0[0] + q1[0]) / 2.0, (q0[1] + q1[1]) / 2.0
    d = math.sqrt((mpx - mqx) ** 2 + (mpy - mqy) ** 2)
    return ca * cs * (lavg / (lavg + d))


def run_fdeb(
    pairs: List[Dict],
    K: float = 0.4,
    S0: float = 0.002,
    I0: int = 50,
    P0: int = 8,
    cycles: int = 4,
    compat_threshold: float = 0.60,
) -> List[Dict]:
    """Force-Directed Edge Bundling.

    pairs: [{'orig': [x, y], 'dest': [x, y], 'count': int}]
    Returns [{'coords': [[x, y], ...], 'count': int}]
    """
    n = len(pairs)
    if n == 0:
        return []

    compat = [[0.0] * n for _ in range(n)]
    antipar = [[False] * n for _ in range(n)]
    for i in range(n):
        dxi = pairs[i]['dest'][0] - pairs[i]['orig'][0]
        dyi = pairs[i]['dest'][1] - pairs[i]['orig'][1]
        for j in range(i + 1, n):
            dxj = pairs[j]['dest'][0] - pairs[j]['orig'][0]
            dyj = pairs[j]['dest'][1] - pairs[j]['orig'][1]
            ap = (dxi * dxj + dyi * dyj) < 0
            antipar[i][j] = antipar[j][i] = ap
            c = _fdeb_compatibility(
                pairs[i]['orig'], pairs[i]['dest'],
                pairs[j]['orig'], pairs[j]['dest'],
            )
            compat[i][j] = compat[j][i] = c

    P = P0
    pts: List[List[List[float]]] = []
    for pair in pairs:
        row: List[List[float]] = []
        for k in range(P + 1):
            t = k / P
            row.append([
                pair['orig'][0] + t * (pair['dest'][0] - pair['orig'][0]),
                pair['orig'][1] + t * (pair['dest'][1] - pair['orig'][1]),
            ])
        pts.append(row)

    S, I = S0, I0
    for c in range(cycles):
        for _ in range(I):
            for e in range(n):
                ep   = pts[e]
                last = len(ep) - 1
                for q in range(1, last):
                    curr = ep[q]
                    fx = K * ((ep[q - 1][0] + ep[q + 1][0]) / 2.0 - curr[0])
                    fy = K * ((ep[q - 1][1] + ep[q + 1][1]) / 2.0 - curr[1])
                    for f in range(n):
                        if compat[e][f] < compat_threshold:
                            continue
                        qi = last - q if antipar[e][f] else q
                        fx += compat[e][f] * (pts[f][qi][0] - curr[0])
                        fy += compat[e][f] * (pts[f][qi][1] - curr[1])
                    ep[q] = [curr[0] + S * fx, curr[1] + S * fy]
        if c < cycles - 1:
            P *= 2
            for e in range(n):
                old = pts[e]
                nxt: List[List[float]] = [old[0]]
                for k in range(1, len(old)):
                    nxt.append([(old[k - 1][0] + old[k][0]) / 2.0,
                                (old[k - 1][1] + old[k][1]) / 2.0])
                    nxt.append(old[k])
                pts[e] = nxt
        S /= 2.0
        I = max(1, int(I * 2 / 3))

    return [{'coords': pts[e], 'count': pairs[e]['count']} for e in range(n)]


def chaikin_smooth(pts: list, iterations: int = 2) -> list:
    """Chaikin corner-cutting smoothing. Each iteration doubles point count."""
    p = pts
    for _ in range(iterations):
        nxt = [p[0]]
        for j in range(len(p) - 1):
            nxt.append([0.75 * p[j][0] + 0.25 * p[j + 1][0],
                        0.75 * p[j][1] + 0.25 * p[j + 1][1]])
            nxt.append([0.25 * p[j][0] + 0.75 * p[j + 1][0],
                        0.25 * p[j][1] + 0.75 * p[j + 1][1]])
        nxt.append(p[-1])
        p = nxt
    return p


def compute_od_bundled_flows(
    conn,
    city_id: int,
    generation_type: str,
    resolution: int = 9,
    pair_limit: int = 5000,
) -> None:
    """Precompute bundled O-D flows for the latest traffic month and store in od_bundled_flows."""
    month: Optional[date] = get_latest_traffic_month(conn, city_id, generation_type)
    if month is None:
        print(f"   ⚠️  No traffic month for city {city_id}/{generation_type}, skipping OD bundling.")
        return

    period = month.strftime('%Y-%m')
    raw = get_od_hex_flows(conn, city_id, generation_type, period=period, resolution=resolution)
    raw_features = raw.get('features') or []
    if not raw_features:
        print(f"   ⚠️  No OD hex flows for city {city_id}/{generation_type}, skipping bundling.")
        return

    # Undirected aggregation: merge A→B with B→A under canonical key min|max
    undirected: Dict[str, dict] = {}
    for f in raw_features:
        props  = f['properties']
        coords = f['geometry']['coordinates']
        oh: str = props['orig_hex']
        dh: str = props['dest_hex']
        count: int = int(props['count'])
        oc, dc = coords[0], coords[-1]
        a, b   = (oh, dh) if oh < dh else (dh, oh)
        ac     = oc if oh < dh else dc
        bc     = dc if oh < dh else oc
        key    = f'{a}|{b}'
        if key in undirected:
            undirected[key]['count'] += count
        else:
            undirected[key] = {'orig': ac, 'dest': bc, 'oh': a, 'dh': b, 'count': count}

    pairs_sorted = sorted(undirected.values(), key=lambda x: -x['count'])[:pair_limit]
    if not pairs_sorted:
        return

    fdeb_input = [{'orig': p['orig'], 'dest': p['dest'], 'count': p['count']} for p in pairs_sorted]
    bundled = run_fdeb(fdeb_input)

    max_count = pairs_sorted[0]['count']
    features = []
    for b, p in zip(bundled, pairs_sorted):
        smooth_coords = chaikin_smooth(b['coords'])
        log_weight = math.log1p(b['count']) / math.log1p(max_count) if max_count > 0 else 0.0
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'LineString', 'coordinates': smooth_coords},
            'properties': {
                'orig_hex':   p['oh'],
                'dest_hex':   p['dh'],
                'count':      b['count'],
                'log_weight': log_weight,
            },
        })

    geojson = {'type': 'FeatureCollection', 'features': features}

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO od_bundled_flows
                (city_id, generation_type, month, resolution, pair_limit, geojson, computed_at)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb, NOW())
            ON CONFLICT (city_id, generation_type, resolution)
            DO UPDATE SET
                month       = EXCLUDED.month,
                pair_limit  = EXCLUDED.pair_limit,
                geojson     = EXCLUDED.geojson,
                computed_at = EXCLUDED.computed_at
            """,
            (city_id, generation_type, month, resolution, pair_limit, json.dumps(geojson)),
        )

    print(f"   ✅ OD bundled: {len(features)} pairs — city {city_id}/{generation_type}/{period}")
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
python -m pytest backend/tests/test_od_bundling.py -v -k "chaikin or fdeb"
```

Expected: 7 tests PASS. The parallel-edges test takes ~5 s.

- [ ] **Step 5: Commit**

```bash
git add backend/processing/od_bundling.py backend/tests/test_od_bundling.py
git commit -m "feat: add run_fdeb, chaikin_smooth, compute_od_bundled_flows to od_bundling.py"
```

---

### Task 4: Integration tests for `compute_od_bundled_flows`

**Files:**
- Modify: `backend/tests/test_od_bundling.py`

- [ ] **Step 1: Append integration tests**

```python
from backend.processing.od_bundling import compute_od_bundled_flows


def test_compute_od_bundled_flows_no_traffic_exits_gracefully(transactional_db):
    """When no traffic month exists the function returns without writing."""
    city_id = get_or_create_city(transactional_db, name="ODComputeNoTraffic")
    compute_od_bundled_flows(transactional_db, city_id, "station_based")
    result, month = get_od_bundled_flows(transactional_db, city_id, "station_based", resolution=9)
    assert result is None


def test_compute_od_bundled_flows_merges_undirected(transactional_db, monkeypatch):
    """A→B and B→A flows are merged into one undirected pair."""
    import backend.processing.od_bundling as mod
    city_id = get_or_create_city(transactional_db, name="ODComputeWrite")

    monkeypatch.setattr(mod, 'get_latest_traffic_month', lambda *a, **kw: date(2024, 3, 1))
    monkeypatch.setattr(mod, 'get_od_hex_flows', lambda *a, **kw: {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {'type': 'LineString', 'coordinates': [[0.0, 0.0], [1.0, 1.0]]},
                'properties': {'count': 10, 'weight': 1.0, 'orig_hex': 'abc', 'dest_hex': 'def'},
            },
            {
                'type': 'Feature',
                'geometry': {'type': 'LineString', 'coordinates': [[1.0, 1.0], [0.0, 0.0]]},
                'properties': {'count': 5, 'weight': 0.5, 'orig_hex': 'def', 'dest_hex': 'abc'},
            },
        ],
    })

    compute_od_bundled_flows(transactional_db, city_id, 'station_based', resolution=9, pair_limit=100)

    result, month = get_od_bundled_flows(transactional_db, city_id, 'station_based', resolution=9)
    assert result is not None
    assert month == date(2024, 3, 1)
    assert len(result['features']) == 1              # A→B + B→A → 1 undirected
    assert result['features'][0]['properties']['count'] == 15   # 10 + 5


def test_compute_od_bundled_flows_upsert_replaces(transactional_db, monkeypatch):
    """Calling compute twice for same (city, generation, resolution) replaces the row."""
    import backend.processing.od_bundling as mod
    city_id = get_or_create_city(transactional_db, name="ODComputeUpsert")

    def patch(count_val, month_val):
        monkeypatch.setattr(mod, 'get_latest_traffic_month', lambda *a, **kw: month_val)
        monkeypatch.setattr(mod, 'get_od_hex_flows', lambda *a, **kw: {
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'geometry': {'type': 'LineString', 'coordinates': [[0.0, 0.0], [1.0, 0.0]]},
                'properties': {'count': count_val, 'weight': 1.0, 'orig_hex': 'aaa', 'dest_hex': 'bbb'},
            }],
        })

    patch(20, date(2024, 2, 1))
    compute_od_bundled_flows(transactional_db, city_id, 'real', resolution=9, pair_limit=100)

    patch(99, date(2024, 3, 1))
    compute_od_bundled_flows(transactional_db, city_id, 'real', resolution=9, pair_limit=100)

    result, month = get_od_bundled_flows(transactional_db, city_id, 'real', resolution=9)
    assert month == date(2024, 3, 1)
    assert result['features'][0]['properties']['count'] == 99
```

- [ ] **Step 2: Run all backend OD tests — expect PASS**

```bash
python -m pytest backend/tests/test_od_bundling.py -v
```

Expected: All 12 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_od_bundling.py
git commit -m "test: integration tests for compute_od_bundled_flows"
```

---

### Task 5: Ingest hook

**Files:**
- Modify: `backend/database/db_io/traffic.py`

- [ ] **Step 1: Add lazy call at end of `upsert_edge_traffic_for_city`**

In `backend/database/db_io/traffic.py`, find the end of `upsert_edge_traffic_for_city` — the last lines are:

```python
    from .cities import refresh_city_modes
    refresh_city_modes(conn, city_id)
```

Append immediately after:

```python
    # Lazy import avoids circular dependency (od_bundling imports from this module)
    try:
        from backend.processing.od_bundling import compute_od_bundled_flows
        compute_od_bundled_flows(conn, city_id, generation_type)
    except Exception as e:
        print(f"   ⚠️  OD bundling failed (non-fatal): {e}")
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
python -m pytest backend/tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/database/db_io/traffic.py
git commit -m "feat: trigger OD bundling at end of upsert_edge_traffic_for_city"
```

---

### Task 6: API route — precomputed lookup

**Files:**
- Modify: `backend/api/routes.py`

- [ ] **Step 1: Add `get_od_bundled_flows` to the import in `routes.py`**

Find the line (around line 36):

```python
    count_trips, count_features, get_nodes, get_edges, get_features, get_od_hex_flows,
```

Change to:

```python
    count_trips, count_features, get_nodes, get_edges, get_features, get_od_hex_flows,
    get_od_bundled_flows,
```

- [ ] **Step 2: Replace the body of `get_od_flows`**

Find the existing `get_od_flows` function and replace its entire body:

```python
@router.get("/cities/{city_id}/trips/od-flows")
def get_od_flows(
    city_id: int,
    generation_type: str = Query(..., description="Trip generation type"),
    period: Optional[str] = Query(None, description="Month filter YYYY-MM"),
    period_from: Optional[str] = Query(None, description="Start month filter YYYY-MM"),
    resolution: int = Query(8, ge=6, le=10, description="H3 resolution (8 ≈ 0.5 km edge)"),
    conn=Depends(get_db_connection),
):
    """O-D flows aggregated by H3 hex as a GeoJSON FeatureCollection."""
    try:
        bundled, stored_month = get_od_bundled_flows(conn, city_id, generation_type, resolution)
        if bundled and period_from is None:
            if period is None:
                return bundled
            if stored_month and stored_month.strftime('%Y-%m') == period:
                return bundled

        geojson = get_od_hex_flows(
            conn, city_id, generation_type,
            period=period, resolution=resolution, period_from=period_from,
        )
        return geojson
    except Exception as e:
        logger.error(f"Error computing OD hex flows for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al calcular flujos O-D")
```

- [ ] **Step 3: Commit**

```bash
git add backend/api/routes.py
git commit -m "feat: serve precomputed OD flows from od_bundled_flows when available"
```

---

### Task 7: Frontend — extract FDEB/Chaikin to `odBundling.ts` and update params

**Files:**
- Create: `frontend/src/utils/odBundling.ts`
- Create: `frontend/src/utils/odBundling.test.ts`
- Modify: `frontend/src/components/city/map/modes/traffic/TrafficTripsLayer.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/utils/odBundling.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { chaikinSmooth, runFDEB } from './odBundling';

describe('chaikinSmooth', () => {
    it('returns input unchanged with 0 iterations', () => {
        const pts: [number, number][] = [[0, 0], [1, 0], [1, 1]];
        expect(chaikinSmooth(pts, 0)).toEqual(pts);
    });

    it('doubles point count each iteration', () => {
        const pts: [number, number][] = [[0, 0], [2, 0], [2, 2]];
        expect(chaikinSmooth(pts, 1)).toHaveLength(6);
        expect(chaikinSmooth(pts, 2)).toHaveLength(12);
    });

    it('preserves endpoints', () => {
        const pts: [number, number][] = [[1, 2], [3, 4], [5, 6]];
        const result = chaikinSmooth(pts, 2);
        expect(result[0]).toEqual(pts[0]);
        expect(result[result.length - 1]).toEqual(pts[pts.length - 1]);
    });

    it('produces correct intermediate values after 1 iteration', () => {
        const pts: [number, number][] = [[0, 0], [2, 0], [2, 2]];
        const r = chaikinSmooth(pts, 1);
        expect(r[1]).toEqual([0.5, 0]);
        expect(r[2]).toEqual([1.5, 0]);
        expect(r[3]).toEqual([2,   0.5]);
        expect(r[4]).toEqual([2,   1.5]);
    });
});

describe('runFDEB', () => {
    it('returns empty array for empty input', () => {
        expect(runFDEB([])).toEqual([]);
    });

    it('returns correct structure for a single pair', () => {
        const pairs = [{ orig: [0, 0] as [number, number], dest: [1, 0] as [number, number], count: 5 }];
        const result = runFDEB(pairs);
        expect(result).toHaveLength(1);
        expect(result[0].count).toBe(5);
        expect(result[0].coords).toHaveLength(65); // P0=8, 4 cycles, 3 doublings → 65 pts
    });

    it('attracts compatible parallel edges toward each other', () => {
        const pairs = [
            { orig: [0, 0]   as [number, number], dest: [1, 0]   as [number, number], count: 10 },
            { orig: [0, 0.2] as [number, number], dest: [1, 0.2] as [number, number], count: 10 },
        ];
        const result = runFDEB(pairs);
        const mid = Math.floor(result[0].coords.length / 2);
        expect(result[0].coords[mid][1]).toBeGreaterThan(0);
        expect(result[1].coords[mid][1]).toBeLessThan(0.2);
    });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd frontend && npx vitest run src/utils/odBundling.test.ts --reporter=verbose
```

Expected: Error — cannot find module `./odBundling`.

- [ ] **Step 3: Create `frontend/src/utils/odBundling.ts`**

```typescript
function fdebCompatibility(
    p0: [number, number], p1: [number, number],
    q0: [number, number], q1: [number, number],
): number {
    const px = p1[0] - p0[0], py = p1[1] - p0[1];
    const qx = q1[0] - q0[0], qy = q1[1] - q0[1];
    const lp = Math.sqrt(px * px + py * py);
    const lq = Math.sqrt(qx * qx + qy * qy);
    if (lp < 1e-9 || lq < 1e-9) return 0;
    const Ca   = Math.abs((px * qx + py * qy) / (lp * lq));
    const lavg = (lp + lq) / 2;
    const Cs   = 2 / (lavg / Math.min(lp, lq) + Math.max(lp, lq) / lavg);
    const mpx  = (p0[0] + p1[0]) / 2, mpy = (p0[1] + p1[1]) / 2;
    const mqx  = (q0[0] + q1[0]) / 2, mqy = (q0[1] + q1[1]) / 2;
    const d    = Math.sqrt((mpx - mqx) ** 2 + (mpy - mqy) ** 2);
    return Ca * Cs * (lavg / (lavg + d));
}

export function runFDEB(
    pairs: Array<{ orig: [number, number]; dest: [number, number]; count: number }>,
    { K = 0.4, S0 = 0.002, I0 = 50, P0 = 8, cycles = 4, compatThreshold = 0.60 } = {},
): Array<{ coords: [number, number][]; count: number }> {
    const n = pairs.length;
    if (n === 0) return [];

    const compat: Float32Array[] = Array.from({ length: n }, () => new Float32Array(n));
    const antipar: Uint8Array[]  = Array.from({ length: n }, () => new Uint8Array(n));
    for (let i = 0; i < n; i++) {
        const dxi = pairs[i].dest[0] - pairs[i].orig[0];
        const dyi = pairs[i].dest[1] - pairs[i].orig[1];
        for (let j = i + 1; j < n; j++) {
            const dxj = pairs[j].dest[0] - pairs[j].orig[0];
            const dyj = pairs[j].dest[1] - pairs[j].orig[1];
            antipar[i][j] = antipar[j][i] = (dxi * dxj + dyi * dyj < 0) ? 1 : 0;
            const c = fdebCompatibility(pairs[i].orig, pairs[i].dest, pairs[j].orig, pairs[j].dest);
            compat[i][j] = compat[j][i] = c;
        }
    }

    let P = P0;
    const pts: [number, number][][] = pairs.map(({ orig, dest }) => {
        const arr: [number, number][] = [];
        for (let k = 0; k <= P; k++) {
            const t = k / P;
            arr.push([orig[0] + t * (dest[0] - orig[0]), orig[1] + t * (dest[1] - orig[1])]);
        }
        return arr;
    });

    let S = S0, I = I0;
    for (let c = 0; c < cycles; c++) {
        for (let iter = 0; iter < I; iter++) {
            for (let e = 0; e < n; e++) {
                const ep   = pts[e];
                const last = ep.length - 1;
                const row  = compat[e];
                const ap   = antipar[e];
                for (let q = 1; q < last; q++) {
                    const curr = ep[q];
                    let fx = K * ((ep[q - 1][0] + ep[q + 1][0]) / 2 - curr[0]);
                    let fy = K * ((ep[q - 1][1] + ep[q + 1][1]) / 2 - curr[1]);
                    for (let f = 0; f < n; f++) {
                        if (row[f] < compatThreshold) continue;
                        const qi = ap[f] ? last - q : q;
                        fx += row[f] * (pts[f][qi][0] - curr[0]);
                        fy += row[f] * (pts[f][qi][1] - curr[1]);
                    }
                    ep[q] = [curr[0] + S * fx, curr[1] + S * fy];
                }
            }
        }
        if (c < cycles - 1) {
            P *= 2;
            for (let e = 0; e < n; e++) {
                const old = pts[e];
                const nxt: [number, number][] = [old[0]];
                for (let k = 1; k < old.length; k++) {
                    nxt.push([(old[k - 1][0] + old[k][0]) / 2, (old[k - 1][1] + old[k][1]) / 2]);
                    nxt.push(old[k]);
                }
                pts[e] = nxt;
            }
        }
        S /= 2;
        I = Math.max(1, Math.floor(I * 2 / 3));
    }

    return pairs.map(({ count }, e) => ({ coords: pts[e], count }));
}

export function chaikinSmooth(pts: [number, number][], iterations = 2): [number, number][] {
    let p = pts;
    for (let i = 0; i < iterations; i++) {
        const next: [number, number][] = [p[0]];
        for (let j = 0; j < p.length - 1; j++) {
            next.push([0.75 * p[j][0] + 0.25 * p[j + 1][0], 0.75 * p[j][1] + 0.25 * p[j + 1][1]]);
            next.push([0.25 * p[j][0] + 0.75 * p[j + 1][0], 0.25 * p[j][1] + 0.75 * p[j + 1][1]]);
        }
        next.push(p[p.length - 1]);
        p = next;
    }
    return p;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd frontend && npx vitest run src/utils/odBundling.test.ts --reporter=verbose
```

Expected: 8 tests PASS.

- [ ] **Step 5: Replace FDEB/Chaikin definitions in `TrafficTripsLayer.tsx` with import**

Remove the `fdebCompatibility`, `runFDEB`, and `chaikinSmooth` function bodies from `TrafficTripsLayer.tsx` (lines 20–127). Add this import near the top of the file with the other imports:

```typescript
import { runFDEB, chaikinSmooth } from '../../../../../utils/odBundling';
```

The calls to `runFDEB` and `chaikinSmooth` inside `buildLayers` are unchanged.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/odBundling.ts frontend/src/utils/odBundling.test.ts frontend/src/components/city/map/modes/traffic/TrafficTripsLayer.tsx
git commit -m "refactor: extract runFDEB/chaikinSmooth to odBundling.ts with updated params (K=0.4, cycles=4)"
```

---

### Task 8: Frontend visual — `ODAccumulationLayer.ts`

**Files:**
- Modify: `frontend/src/components/city/map/modes/traffic/ODAccumulationLayer.ts`

- [ ] **Step 1: Update alpha in `FRAG_COMP` shader**

Find:

```glsl
    // sqrt gives faint flows a fighting chance while heavy bundles stay saturated
    float a   = clamp(sqrt(t) * u_opacity, 0.0, 1.0);
```

Replace with:

```glsl
    // t² suppresses stray edges; true bundles glow prominently
    float a   = clamp(t * t * u_opacity, 0.0, 1.0);
```

- [ ] **Step 2: Shift color ramp midpoint in `flowGradient`**

Find:

```glsl
// Smooth continuous gradient: light indigo → vivid purple → amber
vec3 flowGradient(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 a = vec3(0.78, 0.73, 0.98);  // light indigo
    vec3 b = vec3(0.50, 0.08, 0.86);  // vivid purple
    vec3 c = vec3(0.96, 0.50, 0.08);  // warm amber
    if (t < 0.5) return mix(a, b, t * 2.0);
    return mix(b, c, (t - 0.5) * 2.0);
}
```

Replace with:

```glsl
// Gradient: light indigo → vivid purple → amber; mid at 0.35 so bundles hit amber sooner
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

- [ ] **Step 3: Update `maxCount` in `setData`**

Find:

```typescript
        this.maxCount   = Math.max(10, Math.ceil(features.length * 0.15));
```

Replace with:

```typescript
        const topCount  = features.reduce((m, f) => Math.max(m, (f.properties?.count ?? 0) as number), 0);
        this.maxCount   = Math.max(10, Math.ceil(topCount * 0.08));
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/city/map/modes/traffic/ODAccumulationLayer.ts
git commit -m "feat: sharper OD accumulation — t² alpha, earlier amber ramp, count-based maxCount"
```

---

### Task 9: Frontend — bundling detection in `TrafficTripsLayer.tsx`

**Files:**
- Modify: `frontend/src/components/city/map/modes/traffic/TrafficTripsLayer.tsx`

- [ ] **Step 1: Replace the `buildLayers` callback**

Replace the entire `buildLayers` `useCallback` (from `const buildLayers = useCallback` through its closing `}, [map]);`) with:

```typescript
    const buildLayers = useCallback((geojson: GeoJSON.FeatureCollection) => {
        if (!map) return;

        // Detect whether features are already FDEB-bundled (multi-point) or straight-line (2-point)
        const alreadyBundled =
            geojson.features.length > 0 &&
            (geojson.features[0].geometry as GeoJSON.LineString).coordinates.length > 2;

        if (alreadyBundled) {
            // Precomputed path: assign log_weight and use directly
            const maxCount = geojson.features.reduce(
                (m, f) => Math.max(m, (f.properties?.count ?? 0) as number), 0,
            );
            odFlowsRef.current = geojson.features.map(f => ({
                ...f,
                properties: {
                    ...f.properties,
                    log_weight: Math.log1p(f.properties?.count ?? 0) / Math.log1p(maxCount || 1),
                },
            }));
        } else {
            // Fallback: straight-line features from historical period — run FDEB in JS
            const hexCenter = new Map<string, [number, number]>();
            type UPair = { oh: string; dh: string; oC: [number, number]; dC: [number, number]; count: number };
            const undirected = new Map<string, UPair>();

            for (const f of geojson.features) {
                const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][];
                const oh = f.properties?.orig_hex as string | undefined;
                const dh = f.properties?.dest_hex as string | undefined;
                if (!oh || !dh || oh === dh) continue;
                if (!hexCenter.has(oh)) hexCenter.set(oh, coords[0]);
                if (!hexCenter.has(dh)) hexCenter.set(dh, coords[coords.length - 1]);

                const [a, b]   = oh < dh ? [oh, dh] : [dh, oh];
                const [aC, bC] = oh < dh
                    ? [coords[0], coords[coords.length - 1]]
                    : [coords[coords.length - 1], coords[0]];
                const cnt = (f.properties?.count ?? 0) as number;
                const key = `${a}|${b}`;
                const ex  = undirected.get(key);
                if (ex) { ex.count += cnt; }
                else    { undirected.set(key, { oh: a, dh: b, oC: aC, dC: bC, count: cnt }); }
            }

            const pairs    = [...undirected.values()].sort((a, b) => b.count - a.count).slice(0, 500);
            const bundled  = runFDEB(pairs.map(p => ({ orig: p.oC, dest: p.dC, count: p.count })));
            const maxCount = pairs.length > 0 ? pairs[0].count : 1;

            odFlowsRef.current = bundled.map(({ coords, count }, i) => ({
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: chaikinSmooth(coords) },
                properties: {
                    orig_hex:   pairs[i].oh,
                    dest_hex:   pairs[i].dh,
                    count,
                    log_weight: Math.log1p(count) / Math.log1p(maxCount),
                },
            }));
        }

        // Build node circles from the resolved flows (both paths)
        const nodeHexCenter = new Map<string, [number, number]>();
        const hexFlow       = new Map<string, number>();
        for (const f of odFlowsRef.current) {
            const oh    = f.properties?.orig_hex as string;
            const dh    = f.properties?.dest_hex as string;
            const count = (f.properties?.count ?? 0) as number;
            const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][];
            if (!nodeHexCenter.has(oh)) nodeHexCenter.set(oh, coords[0]);
            if (!nodeHexCenter.has(dh)) nodeHexCenter.set(dh, coords[coords.length - 1]);
            hexFlow.set(oh, (hexFlow.get(oh) ?? 0) + count);
            hexFlow.set(dh, (hexFlow.get(dh) ?? 0) + count);
        }
        const maxHexFlow = Math.max(...hexFlow.values(), 1);
        const nodeFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
        let nodeIdx = 0;
        for (const [hexId, total] of hexFlow) {
            const center = nodeHexCenter.get(hexId);
            if (!center) continue;
            nodeFeatures.push({
                type: 'Feature',
                id: nodeIdx++,
                geometry: { type: 'Point', coordinates: center },
                properties: { hex_id: hexId, flow_norm: total / maxHexFlow },
            });
        }

        // Rebuild map layers
        try {
            [OD_SEL_LAYER, OD_NODE_LAYER].forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
            [OD_SEL_SOURCE, OD_NODE_SOURCE].forEach(s => { if (map.getSource(s)) map.removeSource(s); });
        } catch { /* ok */ }

        if (!accumLayerRef.current) accumLayerRef.current = new ODAccumulationLayer();
        if (!map.getLayer(ACCUM_LAYER_ID)) map.addLayer(accumLayerRef.current);
        accumLayerRef.current.setData(odFlowsRef.current);

        map.addSource(OD_NODE_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: nodeFeatures },
        });
        map.addLayer({
            id: OD_NODE_LAYER,
            type: 'circle',
            source: OD_NODE_SOURCE,
            paint: {
                'circle-radius':       ['interpolate', ['linear'], ['get', 'flow_norm'], 0, 2, 1, 6],
                'circle-color':        ['case', ['boolean', ['feature-state', 'selected'], false], '#f59e0b', '#7c3aed'],
                'circle-opacity':      ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0.65],
                'circle-stroke-width': 1,
                'circle-stroke-color': 'rgba(255,255,255,0.5)',
            },
        });
    }, [map]);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all frontend unit tests**

```bash
cd frontend && npx vitest run --project unit --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 4: Run all backend tests**

```bash
python -m pytest backend/tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/city/map/modes/traffic/TrafficTripsLayer.tsx
git commit -m "feat: detect precomputed OD flows, skip JS FDEB when backend-bundled"
```
