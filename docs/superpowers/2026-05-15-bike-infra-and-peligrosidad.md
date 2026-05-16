# Bike Infrastructure Ingestion + Peligrosidad Index Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich OSM edges in Madrid with municipal bike-infrastructure classification, then expose a `peligrosidad` (danger) score and `route_cost` SQL functions to feed future safety-aware routing.

**Architecture:**
1. Add **one** column `bike_infra TEXT` to `edges` (NULL by default). Populated only for Madrid edges that spatially match the official Madrid bike-infra shapefile. Never overwrites OSM tags.
2. Two `IMMUTABLE` SQL functions: `peligrosidad_score(...)` and `route_cost(length, peligrosidad)`. Pure computations over existing edge columns — no extra storage.
3. Standalone city-specific ingestion script `ingestion/02_geometry/022_load_madrid_bike_infra.py` that downloads the SHP, spatially joins to OSM edges in geopandas, and bulk-updates `bike_infra`.

**Tech Stack:** PostgreSQL/PostGIS, Python 3.11, geopandas, shapely, psycopg2, existing `backend/database/db_io` helpers.

---

## Calibration reference

### Peligrosidad components (additive, except bridge/tunnel which acts as floor)

| Source | Score |
|---|---|
| `highway = cycleway` (or `bike_infra = 'cycleway'`) | 0 |
| `highway = living_street` | 1 |
| `highway IN ('residential','tertiary')` | 3 |
| `highway = 'secondary'` (or `bike_infra = 'secondary'`) | 6 |
| `highway = 'primary'` | 12 |
| `highway = 'trunk'` | 20 |
| `tunnel = TRUE` OR `bridge = TRUE` | floor at 20 (via `GREATEST`) |
| Unknown / default | 6 (conservative) |

Madrid `bike_infra` **only lowers** the score (LEAST), never raises it — a residential street that's also a `via uso compartido` (Madrid says "secondary") stays at 3 because residential is already safer.

### Speed penalty (uses `maxspeed[1]`)
| maxspeed (km/h) | Penalty |
|---|---|
| ≤ 20 | 0 |
| ≤ 30 | +2 |
| ≤ 40 | +4 |
| ≤ 50 | +8 |
| > 50 | +16 |

### Lanes penalty (uses `lanes[1]`)
| lanes | Penalty |
|---|---|
| 1 or NULL | 0 |
| 2 | +4 |
| 3 | +8 |
| ≥ 4 | +16 |

### Route cost (calibrated to user spec)

```
route_cost(length_m, peligrosidad) =
    length_m * (1 + peligrosidad * LOG(GREATEST(length_m, 1)) / 144)
```

Verification (PostgreSQL `LOG()` is base-10):
- **100 m cycleway** (peligrosidad=0): `100 * (1 + 0) = 100` ✓
- **100 m primary, 4 lanes, 50 km/h** (peligrosidad = 12 + 8 + 16 = 36): `100 * (1 + 36 * log10(100)/144) = 100 * (1 + 0.5) = 150` ✓
- **500 m primary, 4 lanes, 50 km/h**: `500 * (1 + 36 * log10(500)/144) ≈ 500 * 1.675 = 837.5 ≈ 850` ✓
- **1 m primary**: log10(1)=0 → no penalty for tiny edges (avoids log overflow)

The constant `144` is the calibration knob; it makes the user's 100m vs 500m primary anchors land within ±2%.

---

## File Structure

**Create:**
- `backend/database/migrations/008_edges_bike_infra.sql` — adds `bike_infra` column + btree index
- `backend/database/migrations/009_peligrosidad_functions.sql` — adds `peligrosidad_score()` and `route_cost()` functions
- `ingestion/02_geometry/022_load_madrid_bike_infra.py` — downloads SHP, spatial match, UPDATE edges
- `integration_tests/test_peligrosidad.py` — verifies SQL function outputs match calibration spec
- `integration_tests/test_bike_infra_ingestion.py` — verifies Madrid edges get `bike_infra` populated

**Modify:**
- `backend/database/schema.sql` — add `bike_infra TEXT` to the canonical `edges` definition (so fresh DBs match)
- `ingestion/run_ingestion.sh` — insert Madrid bike infra step after `021_calculate_infra_metrics.py`

---

## Task 1: Migration — add `bike_infra` column

**Files:**
- Create: `backend/database/migrations/008_edges_bike_infra.sql`
- Modify: `backend/database/schema.sql` (~line 168, after `component_id`)

- [ ] **Step 1: Write migration**

Create `backend/database/migrations/008_edges_bike_infra.sql`:

```sql
-- Migration 008: Add Madrid bike-infrastructure classification to edges.
--
-- bike_infra is a city-specific enrichment column. It is populated ONLY for
-- edges that spatially match Madrid's official "vías ciclistas" shapefile.
-- Values are mapped onto OSM-like terminology so the peligrosidad function
-- can treat them uniformly:
--   'cycleway'  = VÍA EXCLUSIVA BICI or ANILLO VERDE CICLISTA
--   'secondary' = VÍA USO COMPARTIDO or VÍA PREFERENTE BICI
-- NULL means: no Madrid data for this edge (or non-Madrid city).
--
-- This column NEVER overwrites OSM's `highway` tag. Peligrosidad takes the
-- LEAST (safer) of the two when both are present.

ALTER TABLE edges
    ADD COLUMN IF NOT EXISTS bike_infra TEXT;

CREATE INDEX IF NOT EXISTS idx_edges_bike_infra
    ON edges (bike_infra)
    WHERE bike_infra IS NOT NULL;
```

- [ ] **Step 2: Update `schema.sql`**

In `backend/database/schema.sql`, in the `CREATE TABLE IF NOT EXISTS edges` block, add one line after `component_id INTEGER,`:

```sql
    bike_infra TEXT,                                -- city-specific bike-infra category (Madrid only for now)
```

- [ ] **Step 3: Apply migration to local DB**

Run:
```bash
psql -d b4c -f backend/database/migrations/008_edges_bike_infra.sql
```
Expected output: `ALTER TABLE` then `CREATE INDEX`.

- [ ] **Step 4: Verify column exists**

Run:
```bash
psql -d b4c -c "\d edges" | grep bike_infra
```
Expected: `bike_infra | text |`

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/008_edges_bike_infra.sql backend/database/schema.sql
git commit -m "feat(db): add bike_infra column to edges for municipal bike-infra enrichment"
```

---

## Task 2: Migration — `peligrosidad_score()` and `route_cost()` SQL functions

**Files:**
- Create: `backend/database/migrations/009_peligrosidad_functions.sql`

- [ ] **Step 1: Write migration**

Create `backend/database/migrations/009_peligrosidad_functions.sql`:

```sql
-- Migration 009: peligrosidad (danger) score and route_cost SQL functions.
--
-- Both functions are IMMUTABLE so Postgres can inline them inside routing
-- queries without re-executing per row. They operate purely on existing
-- edge columns + the new bike_infra column.

-- ─────────────────────────────────────────────────────────────────────────
-- peligrosidad_score
--   Returns integer in roughly [0, 60]. Higher = more dangerous for cycling.
--   Composition:
--     base = highway-class score, lowered by bike_infra if Madrid gave us
--            a safer classification (LEAST), then raised to 20 floor if
--            the edge is a bridge or tunnel (GREATEST).
--     + speed penalty from maxspeed[1] (urban OSM convention: first value)
--     + lanes penalty from lanes[1]
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION peligrosidad_score(
    p_highway   TEXT,
    p_bike_infra TEXT,
    p_maxspeed  INTEGER[],
    p_lanes     INTEGER[],
    p_tunnel    BOOLEAN,
    p_bridge    BOOLEAN
) RETURNS INTEGER
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
    SELECT
        -- Base (highway/bike_infra) with bridge/tunnel floor at 20
        GREATEST(
            CASE WHEN p_tunnel OR p_bridge THEN 20 ELSE 0 END,
            -- LEAST(bike_infra_score, highway_score)
            LEAST(
                CASE p_bike_infra
                    WHEN 'cycleway'  THEN 0
                    WHEN 'secondary' THEN 6
                    ELSE 999  -- effectively infinity → highway wins
                END,
                CASE p_highway
                    WHEN 'cycleway'      THEN 0
                    WHEN 'living_street' THEN 1
                    WHEN 'residential'   THEN 3
                    WHEN 'tertiary'      THEN 3
                    WHEN 'secondary'     THEN 6
                    WHEN 'primary'       THEN 12
                    WHEN 'trunk'         THEN 20
                    ELSE 6   -- conservative default for unknown/NULL
                END
            )
        )
        -- Speed penalty
        + CASE
            WHEN p_maxspeed IS NULL OR array_length(p_maxspeed, 1) IS NULL
                                                   THEN 0
            WHEN p_maxspeed[1] <= 20               THEN 0
            WHEN p_maxspeed[1] <= 30               THEN 2
            WHEN p_maxspeed[1] <= 40               THEN 4
            WHEN p_maxspeed[1] <= 50               THEN 8
            ELSE                                        16
        END
        -- Lanes penalty
        + CASE
            WHEN p_lanes IS NULL OR array_length(p_lanes, 1) IS NULL
                                       THEN 0
            WHEN p_lanes[1] <= 1       THEN 0
            WHEN p_lanes[1] = 2        THEN 4
            WHEN p_lanes[1] = 3        THEN 8
            ELSE                            16
        END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- route_cost
--   Cost of traversing a `length`-meter edge with given peligrosidad.
--   Calibration anchors (set K = 144):
--       100m cycleway      → 100
--       100m primary 4-lane @50  → ~150
--       500m primary 4-lane @50  → ~850
--   GREATEST(length,1) prevents log10(0) for sub-1m edges at intersections.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION route_cost(
    p_length         DOUBLE PRECISION,
    p_peligrosidad   INTEGER
) RETURNS DOUBLE PRECISION
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
    SELECT p_length * (
        1 + COALESCE(p_peligrosidad, 0) * LOG(GREATEST(p_length, 1)) / 144.0
    );
$$;
```

- [ ] **Step 2: Apply migration**

```bash
psql -d b4c -f backend/database/migrations/009_peligrosidad_functions.sql
```
Expected: two `CREATE FUNCTION` lines.

- [ ] **Step 3: Smoke-test in psql**

```bash
psql -d b4c <<'SQL'
SELECT peligrosidad_score('cycleway', NULL, NULL, NULL, FALSE, FALSE)        AS cycleway,
       peligrosidad_score('primary',  NULL, ARRAY[50], ARRAY[4], FALSE, FALSE) AS prim_4l_50,
       peligrosidad_score('primary',  'cycleway', ARRAY[50], ARRAY[4], FALSE, FALSE) AS prim_upgraded,
       peligrosidad_score('residential', NULL, NULL, NULL, TRUE, FALSE)       AS resid_tunnel;
SELECT route_cost(100, 0)  AS cycleway_100m,
       route_cost(100, 36) AS prim_100m,
       route_cost(500, 36) AS prim_500m;
SQL
```
Expected:
```
 cycleway | prim_4l_50 | prim_upgraded | resid_tunnel
        0 |         36 |             8 |           20
 cycleway_100m | prim_100m | prim_500m
           100 |       150 |  ~837.5
```

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/009_peligrosidad_functions.sql
git commit -m "feat(db): add peligrosidad_score and route_cost SQL functions"
```

---

## Task 3: Test — peligrosidad calibration suite

**Files:**
- Create: `integration_tests/test_peligrosidad.py`

- [ ] **Step 1: Write the failing test**

Create `integration_tests/test_peligrosidad.py`:

```python
"""
Integration test: verify peligrosidad_score and route_cost SQL functions
match the spec in docs/superpowers/2026-05-15-bike-infra-and-peligrosidad.md.

Run:  python integration_tests/test_peligrosidad.py
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from backend.database.db_io.connection import connect_db


PELIGROSIDAD_CASES = [
    # (highway, bike_infra, maxspeed, lanes, tunnel, bridge, expected)
    ("cycleway",      None,        None,    None,    False, False,  0),
    ("living_street", None,        None,    None,    False, False,  1),
    ("residential",   None,        None,    None,    False, False,  3),
    ("tertiary",      None,        None,    None,    False, False,  3),
    ("secondary",     None,        None,    None,    False, False,  6),
    ("primary",       None,        None,    None,    False, False, 12),
    ("trunk",         None,        None,    None,    False, False, 20),

    # Bridge/tunnel floor of 20
    ("residential",   None,        None,    None,    True,  False, 20),
    ("residential",   None,        None,    None,    False, True,  20),
    # Bridge does not exceed trunk
    ("trunk",         None,        None,    None,    True,  False, 20),

    # Speed penalties
    ("residential",   None,        [20],    None,    False, False,  3),
    ("residential",   None,        [30],    None,    False, False,  5),  # 3 + 2
    ("residential",   None,        [40],    None,    False, False,  7),  # 3 + 4
    ("residential",   None,        [50],    None,    False, False, 11),  # 3 + 8
    ("residential",   None,        [70],    None,    False, False, 19),  # 3 + 16

    # Lane penalties
    ("residential",   None,        None,    [1],     False, False,  3),
    ("residential",   None,        None,    [2],     False, False,  7),  # 3 + 4
    ("residential",   None,        None,    [3],     False, False, 11),  # 3 + 8
    ("residential",   None,        None,    [4],     False, False, 19),  # 3 + 16
    ("residential",   None,        None,    [6],     False, False, 19),  # 3 + 16

    # bike_infra upgrades safety (LEAST)
    ("primary",       "cycleway",  None,    None,    False, False,  0),
    ("primary",       "secondary", None,    None,    False, False,  6),
    # bike_infra does NOT raise danger above existing OSM class
    ("residential",   "secondary", None,    None,    False, False,  3),

    # Full primary urban (calibration anchor for route_cost): 12 + 8 + 16 = 36
    ("primary",       None,        [50],    [4],     False, False, 36),
]

ROUTE_COST_CASES = [
    # (length_m, peligrosidad, expected)
    (100.0,  0, 100.0),
    (100.0, 36, 150.0),    # primary 4-lane 50kmh
    (500.0, 36, 837.5),    # logarithmic scaling — must land within ±15 of 850
    (1.0,   36,   1.0),    # log10(1) = 0 → no penalty
    (10.0,   0,  10.0),
]


def main() -> int:
    load_dotenv()
    conn = connect_db()
    cur = conn.cursor()

    failures = []

    print("\n🧪 peligrosidad_score()")
    for case in PELIGROSIDAD_CASES:
        hw, bi, ms, ln, tn, br, expected = case
        cur.execute(
            "SELECT peligrosidad_score(%s, %s, %s, %s, %s, %s)",
            (hw, bi, ms, ln, tn, br),
        )
        actual = cur.fetchone()[0]
        ok = actual == expected
        marker = "✓" if ok else "✗"
        print(f"  {marker} hw={hw!r:14} bi={bi!r:11} ms={ms} ln={ln} tn={tn} br={br}"
              f"  → {actual}  (expected {expected})")
        if not ok:
            failures.append((case, actual))

    print("\n🧪 route_cost()")
    for length, p, expected in ROUTE_COST_CASES:
        cur.execute("SELECT route_cost(%s, %s)", (length, p))
        actual = cur.fetchone()[0]
        # Allow ±15 absolute tolerance for the logarithmic 500m anchor
        ok = abs(actual - expected) <= max(1.0, expected * 0.02)
        marker = "✓" if ok else "✗"
        print(f"  {marker} length={length:6.1f}m  peligrosidad={p:3d}"
              f"  → {actual:7.2f}  (expected ~{expected})")
        if not ok:
            failures.append((("route_cost", length, p), actual))

    cur.close()
    conn.close()

    if failures:
        print(f"\n❌ {len(failures)} test(s) failed:")
        for case, actual in failures:
            print(f"   {case} → got {actual}")
        return 1
    print(f"\n✅ All {len(PELIGROSIDAD_CASES) + len(ROUTE_COST_CASES)} cases passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run test (expect it to PASS since functions already exist from Task 2)**

```bash
b4c_venv/bin/python integration_tests/test_peligrosidad.py
```
Expected: `✅ All N cases passed.`

If any case fails, fix the SQL function in migration 009 and re-apply with `psql -f`, then re-run the test.

- [ ] **Step 3: Commit**

```bash
git add integration_tests/test_peligrosidad.py
git commit -m "test: peligrosidad and route_cost calibration suite"
```

---

## Task 4: Madrid bike-infra ingestion — script skeleton + download

**Files:**
- Create: `ingestion/02_geometry/022_load_madrid_bike_infra.py`

- [ ] **Step 1: Write skeleton with download + standard ingestion-status pattern**

Create `ingestion/02_geometry/022_load_madrid_bike_infra.py`:

```python
"""
022_load_madrid_bike_infra.py
Enriches Madrid edges with the city's official bike-infrastructure
classification from Datos Abiertos Madrid (dataset 205107).

Source:  https://datos.madrid.es/dataset/205107-0-vias-ciclistas
File:    https://geoportal.madrid.es/fsdescargas/IDEAM_WBGEOPORTAL/OBRAS/BICI/Infraestructura_Ciclista.zip
Format:  Shapefile (EPSG:25830), 1,437 LineString/MultiLineString features.

Mapping (Madrid d_COD_TIPO → edges.bike_infra):
    VÍA EXCLUSIVA BICI      → 'cycleway'
    ANILLO VERDE CICLISTA   → 'cycleway'
    VÍA USO COMPARTIDO      → 'secondary'
    VÍA PREFERENTE BICI     → 'secondary'
    GIROS Y SENTIDOS        → skipped (directional guidance only, ~1 km total)

Spatial-match strategy: buffer each Madrid segment by 8 m, then for each OSM
edge that intersects, compute the fraction of edge length inside the buffer.
If >= 50%, classify the edge with Madrid's category. When multiple Madrid
categories overlap a single edge, prefer 'cycleway' over 'secondary'.

Never overwrites OSM tags; only writes to `edges.bike_infra`.
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import geopandas as gpd
import requests
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io.connection import connect_db
from backend.database.db_io.cities import (
    get_city_id_by_name,
    upsert_ingestion_status,
    get_ingestion_status,
    check_prerequisites,
)

SOURCE_URL = (
    "https://geoportal.madrid.es/fsdescargas/IDEAM_WBGEOPORTAL/"
    "OBRAS/BICI/Infraestructura_Ciclista.zip"
)
PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOCAL_ZIP = PROJECT_ROOT / "data" / "Infraestructura_Ciclista.zip"

CYCLEWAY_TIPOS = {"VÍA EXCLUSIVA BICI", "ANILLO VERDE CICLISTA"}
SECONDARY_TIPOS = {"VÍA USO COMPARTIDO", "VÍA PREFERENTE BICI"}

BUFFER_M = 8.0          # lateral tolerance for spatial match
MIN_OVERLAP_RATIO = 0.5 # fraction of edge length that must lie inside the buffer


def download_shapefile() -> Path:
    """Download Madrid bike-infra ZIP unless cached."""
    if LOCAL_ZIP.exists():
        print(f"  📦 Using cached {LOCAL_ZIP.relative_to(PROJECT_ROOT)}"
              f" ({LOCAL_ZIP.stat().st_size / 1024:.0f} KB)")
        return LOCAL_ZIP
    print(f"  ⬇️  Downloading from geoportal.madrid.es…")
    LOCAL_ZIP.parent.mkdir(parents=True, exist_ok=True)
    resp = requests.get(SOURCE_URL, timeout=60)
    resp.raise_for_status()
    LOCAL_ZIP.write_bytes(resp.content)
    print(f"  ✓ Saved {LOCAL_ZIP.stat().st_size / 1024:.0f} KB")
    return LOCAL_ZIP


def load_madrid_infra() -> gpd.GeoDataFrame:
    """Load Madrid bike-infra SHP and map categories to bike_infra values."""
    zip_path = download_shapefile()
    gdf = gpd.read_file(f"zip://{zip_path}")
    # Map to target values
    gdf["bike_infra"] = gdf["d_COD_TIPO"].map(
        lambda t: "cycleway" if t in CYCLEWAY_TIPOS
        else "secondary" if t in SECONDARY_TIPOS
        else None
    )
    before = len(gdf)
    gdf = gdf[gdf["bike_infra"].notnull()].copy()
    print(f"  ✓ Loaded {before} Madrid features; "
          f"{len(gdf)} usable after filtering GIROS Y SENTIDOS")
    return gdf


def main():
    load_dotenv()
    conn = connect_db()
    try:
        city_id = get_city_id_by_name(conn, "Madrid")
        if city_id is None:
            print("❌ Madrid city not found in DB. Run 010_load_cities.py first.")
            return

        missing = check_prerequisites(conn, ["020_load_osm"], city_id=city_id)
        if missing:
            print(f"⚠️  Skipping: prerequisites not met: {missing}")
            return

        pname = "022_load_madrid_bike_infra"
        status_obj = get_ingestion_status(conn, pname, city_id=city_id)
        if (status_obj and status_obj.get("status") == "SUCCESS"
                and "--force" not in sys.argv):
            print(f"⏭️  Already SUCCESS for Madrid. Use --force to re-run.")
            return

        upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
        try:
            n_updated = enrich_madrid_edges(conn, city_id)
            conn.commit()
            upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)
            print(f"\n🎯 Done. {n_updated} edges enriched with bike_infra.")
        except Exception as e:
            conn.rollback()
            upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
            raise
    finally:
        conn.close()


def enrich_madrid_edges(conn, city_id: int) -> int:
    """Placeholder — implemented in Task 5."""
    raise NotImplementedError("Implemented in Task 5")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke test the download**

```bash
b4c_venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from ingestion.__init__ import *  # noqa
import importlib.util
spec = importlib.util.spec_from_file_location('m', 'ingestion/02_geometry/022_load_madrid_bike_infra.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
gdf = m.load_madrid_infra()
print(gdf['bike_infra'].value_counts().to_string())
"
```
Expected output (counts):
```
secondary    793
cycleway     637
```
(The exact numbers may differ by a few — Madrid updates monthly.)

- [ ] **Step 3: Commit**

```bash
git add ingestion/02_geometry/022_load_madrid_bike_infra.py
git commit -m "feat(ingestion): scaffold Madrid bike-infra loader with SHP download"
```

---

## Task 5: Spatial matching — implement `enrich_madrid_edges`

**Files:**
- Modify: `ingestion/02_geometry/022_load_madrid_bike_infra.py` (replace the `enrich_madrid_edges` stub)

- [ ] **Step 1: Replace the stub with the real implementation**

In `ingestion/02_geometry/022_load_madrid_bike_infra.py`, replace the `enrich_madrid_edges` function with:

```python
def enrich_madrid_edges(conn, city_id: int) -> int:
    """
    Spatial-match Madrid bike-infra polylines to OSM edges and update
    edges.bike_infra. Returns number of edges updated.

    Strategy:
      1. Load Madrid features (EPSG:25830, native metric CRS).
      2. Load Madrid edges (PostGIS 4326) into geopandas, project to 25830.
      3. Buffer each Madrid feature by 8m. Spatial join: edges that
         intersect the buffer.
      4. For each (edge, madrid) pair, compute overlap length / edge length.
         Keep if >= 0.5.
      5. If an edge matches multiple Madrid features, prefer 'cycleway' > 'secondary'.
      6. Bulk UPDATE edges SET bike_infra = ... WHERE id IN (...).
    """
    import psycopg2.extras
    from shapely.ops import unary_union

    madrid_gdf = load_madrid_infra()           # 4326 by default
    madrid_gdf = madrid_gdf.to_crs(epsg=25830) # native CRS for buffer in meters

    print(f"  📡 Loading Madrid edges from DB (city_id={city_id})…")
    edges_sql = """
        SELECT id, ST_AsBinary(geom) AS wkb
        FROM edges
        WHERE city_id = %s
    """
    cur = conn.cursor()
    cur.execute(edges_sql, (city_id,))
    rows = cur.fetchall()
    cur.close()
    print(f"     {len(rows):,} edges loaded.")

    from shapely import wkb as shapely_wkb
    edges_gdf = gpd.GeoDataFrame(
        {"id": [r[0] for r in rows]},
        geometry=[shapely_wkb.loads(bytes(r[1])) for r in rows],
        crs="EPSG:4326",
    ).to_crs(epsg=25830)
    edges_gdf["len_m"] = edges_gdf.geometry.length

    # Buffer Madrid features. Then sjoin edges to buffers.
    print(f"  🧮 Buffering Madrid features by {BUFFER_M}m and spatial-joining…")
    madrid_gdf["geometry"] = madrid_gdf.geometry.buffer(BUFFER_M)

    joined = gpd.sjoin(
        edges_gdf, madrid_gdf[["bike_infra", "geometry"]],
        how="inner", predicate="intersects"
    )
    print(f"     {len(joined):,} candidate edge × buffer intersections.")

    if joined.empty:
        print("  ⚠️  No spatial matches; nothing to update.")
        return 0

    # Compute overlap ratio per row
    # geopandas sjoin loses the right-side geometry; re-join to bring it back
    joined = joined.reset_index(drop=False).rename(columns={"index": "edge_idx"})
    madrid_lookup = madrid_gdf[["geometry"]].rename(columns={"geometry": "buf_geom"})
    joined = joined.merge(
        madrid_lookup, left_on="index_right", right_index=True, how="left"
    )

    def overlap_ratio(row) -> float:
        edge_geom = edges_gdf.loc[row["edge_idx"], "geometry"]
        try:
            inter = edge_geom.intersection(row["buf_geom"])
            return float(inter.length) / max(float(edge_geom.length), 1e-6)
        except Exception:
            return 0.0

    joined["overlap"] = joined.apply(overlap_ratio, axis=1)
    matches = joined[joined["overlap"] >= MIN_OVERLAP_RATIO].copy()
    print(f"     {len(matches):,} matches above {MIN_OVERLAP_RATIO:.0%} overlap.")

    # Aggregate per edge: prefer 'cycleway' over 'secondary'
    PRIORITY = {"cycleway": 1, "secondary": 0}
    matches["prio"] = matches["bike_infra"].map(PRIORITY)
    best = (matches.sort_values("prio", ascending=False)
                   .drop_duplicates(subset=["id"], keep="first")
                   [["id", "bike_infra"]])
    print(f"     {len(best):,} unique edges to update.")

    # Bulk UPDATE
    cur = conn.cursor()
    psycopg2.extras.execute_values(
        cur,
        """
        UPDATE edges AS e
        SET bike_infra = v.bike_infra
        FROM (VALUES %s) AS v(id, bike_infra)
        WHERE e.id = v.id
        """,
        list(best.itertuples(index=False, name=None)),
        template="(%s, %s)",
        page_size=1000,
    )
    cur.close()

    # Summary by category
    summary = best["bike_infra"].value_counts().to_dict()
    for k, v in summary.items():
        print(f"     ✓ {k:10}: {v:,} edges")

    return len(best)
```

- [ ] **Step 2: Run end-to-end against local DB**

```bash
b4c_venv/bin/python ingestion/02_geometry/022_load_madrid_bike_infra.py --force
```
Expected: completes without exception, prints "X edges enriched". A reasonable count is ~3,000–8,000 Madrid edges out of ~150k.

- [ ] **Step 3: Verify in DB**

```bash
psql -d b4c <<'SQL'
SELECT bike_infra, COUNT(*)
FROM edges
WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
GROUP BY bike_infra
ORDER BY 2 DESC;
SQL
```
Expected: two non-NULL rows (cycleway, secondary) plus a NULL row covering the bulk of edges.

- [ ] **Step 4: Spot-check that OSM tags were preserved**

```bash
psql -d b4c <<'SQL'
SELECT id, highway, bike_infra, name
FROM edges
WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
  AND bike_infra = 'cycleway'
  AND highway != 'cycleway'
LIMIT 10;
SQL
```
Expected: some rows — these are edges where OSM didn't tag a cycleway but Madrid says it's an exclusive bike lane. `highway` column is unchanged.

- [ ] **Step 5: Commit**

```bash
git add ingestion/02_geometry/022_load_madrid_bike_infra.py
git commit -m "feat(ingestion): spatial-match Madrid bike infra to OSM edges and update bike_infra column"
```

---

## Task 6: Integration test for ingestion

**Files:**
- Create: `integration_tests/test_bike_infra_ingestion.py`

- [ ] **Step 1: Write the test**

Create `integration_tests/test_bike_infra_ingestion.py`:

```python
"""
Integration test: after Madrid bike-infra ingestion, verify that:
  1. Some edges have bike_infra populated.
  2. OSM `highway` is never silently overwritten.
  3. peligrosidad_score on a known-cycleway Madrid edge is <= the score
     it would have without bike_infra.

Run:  python integration_tests/test_bike_infra_ingestion.py
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from backend.database.db_io.connection import connect_db


def main() -> int:
    load_dotenv()
    conn = connect_db()
    cur = conn.cursor()
    failures = []

    # 1. Bike infra is populated for Madrid
    cur.execute("""
        SELECT bike_infra, COUNT(*)
        FROM edges
        WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
          AND bike_infra IS NOT NULL
        GROUP BY bike_infra
    """)
    by_cat = dict(cur.fetchall())
    n_cycleway = by_cat.get("cycleway", 0)
    n_secondary = by_cat.get("secondary", 0)
    print(f"  cycleway:  {n_cycleway:,} edges")
    print(f"  secondary: {n_secondary:,} edges")
    if n_cycleway < 100:
        failures.append(f"Expected >100 cycleway edges, got {n_cycleway}")
    if n_secondary < 100:
        failures.append(f"Expected >100 secondary edges, got {n_secondary}")

    # 2. Sanity: bike_infra='cycleway' edges include some that OSM had as
    #    NOT-cycleway (proving Madrid added new information).
    cur.execute("""
        SELECT COUNT(*) FROM edges
        WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
          AND bike_infra = 'cycleway' AND highway != 'cycleway'
    """)
    n_new = cur.fetchone()[0]
    print(f"  new cycleways (not in OSM): {n_new:,}")
    if n_new == 0:
        failures.append("Madrid added zero new cycleways — spatial match suspicious")

    # 3. peligrosidad consistency: for any 'cycleway' bike_infra edge,
    #    peligrosidad <= what OSM alone would have given.
    cur.execute("""
        SELECT
          peligrosidad_score(highway, bike_infra, maxspeed, lanes, tunnel, bridge) AS with_infra,
          peligrosidad_score(highway, NULL,       maxspeed, lanes, tunnel, bridge) AS without_infra
        FROM edges
        WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
          AND bike_infra = 'cycleway'
        LIMIT 200
    """)
    rows = cur.fetchall()
    bad = [r for r in rows if r[0] > r[1]]
    print(f"  cycleway peligrosidad-monotonicity check: "
          f"{len(rows) - len(bad)}/{len(rows)} OK")
    if bad:
        failures.append(f"{len(bad)} edges have HIGHER peligrosidad with bike_infra")

    cur.close()
    conn.close()

    if failures:
        print("\n❌ Failures:")
        for f in failures:
            print(f"   - {f}")
        return 1
    print("\n✅ All ingestion checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run it**

```bash
b4c_venv/bin/python integration_tests/test_bike_infra_ingestion.py
```
Expected: `✅ All ingestion checks passed.`

- [ ] **Step 3: Commit**

```bash
git add integration_tests/test_bike_infra_ingestion.py
git commit -m "test: verify Madrid bike-infra ingestion populates edges and preserves OSM"
```

---

## Task 7: Wire into ingestion pipeline

**Files:**
- Modify: `ingestion/run_ingestion.sh`

- [ ] **Step 1: Insert step after `021_calculate_infra_metrics.py`**

In `ingestion/run_ingestion.sh`, find the "Phase 2: Geometry & Infrastructure" block:

```bash
# 2. Geometry & Infrastructure
echo -e "\n${GREEN}--- Phase 2: Geometry & Infrastructure ---${NC}"
python3 ingestion/02_geometry/020_load_osm.py
python3 ingestion/02_geometry/021_calculate_infra_metrics.py
```

Replace with:

```bash
# 2. Geometry & Infrastructure
echo -e "\n${GREEN}--- Phase 2: Geometry & Infrastructure ---${NC}"
python3 ingestion/02_geometry/020_load_osm.py
python3 ingestion/02_geometry/021_calculate_infra_metrics.py
# 022 – Madrid-only: enrich edges with municipal bike-infra classification
python3 ingestion/02_geometry/022_load_madrid_bike_infra.py
```

- [ ] **Step 2: Verify the script handles non-Madrid gracefully**

The script already early-returns if "Madrid" city isn't found (see Task 4 main). So if `run_ingestion.sh` is executed in a deployment without Madrid, it just prints `❌ Madrid city not found in DB.` and exits cleanly without raising — but check that `set -e` at the top of the shell script doesn't bail out:

Open `ingestion/02_geometry/022_load_madrid_bike_infra.py` and make sure the `if city_id is None` branch returns normally (no `sys.exit(1)`). Verify by reading it; the version from Task 4 already uses `return`, which is fine.

- [ ] **Step 3: Commit**

```bash
git add ingestion/run_ingestion.sh
git commit -m "chore(ingestion): wire Madrid bike-infra step into run_ingestion.sh"
```

---

## Task 8: Final verification + PR-readiness check

- [ ] **Step 1: Run both integration tests**

```bash
b4c_venv/bin/python integration_tests/test_peligrosidad.py
b4c_venv/bin/python integration_tests/test_bike_infra_ingestion.py
```
Both should print `✅ All ... passed.`

- [ ] **Step 2: Sanity sweep — random edge inspection**

```bash
psql -d b4c <<'SQL'
SELECT id, highway, bike_infra, maxspeed, lanes, tunnel, bridge,
       peligrosidad_score(highway, bike_infra, maxspeed, lanes, tunnel, bridge) AS p,
       length,
       ROUND(route_cost(length, peligrosidad_score(highway, bike_infra, maxspeed, lanes, tunnel, bridge))::numeric, 2) AS cost
FROM edges
WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
ORDER BY random()
LIMIT 20;
SQL
```
Eyeball the output: cycleways should have peligrosidad 0–8, primary roads should be 20+, costs should scale roughly with length × danger.

- [ ] **Step 3: Final status**

```bash
git log --oneline main..HEAD
```
Expect ~7 commits, each focused.

---

## Self-Review Checklist

- [x] Spec coverage: bike_infra column ✓, Madrid script ✓, peligrosidad formula ✓, route_cost calibration ✓, pipeline wiring ✓, tests ✓
- [x] No placeholders — every code block is complete
- [x] Type consistency: `bike_infra TEXT`, `peligrosidad_score(...) RETURNS INTEGER`, `route_cost(DOUBLE PRECISION, INTEGER) RETURNS DOUBLE PRECISION` used consistently across tasks
- [x] Frequent commits (~7), each one a coherent unit
- [x] TDD ordering: Task 3 verifies SQL functions before any production code that depends on them; Task 6 verifies ingestion before pipeline wiring
