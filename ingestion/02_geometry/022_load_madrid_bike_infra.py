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

Spatial-match strategy (implemented in Task 5): buffer each Madrid segment by 8 m,
then for each OSM edge that intersects, compute the fraction of edge length inside
the buffer. If >= 50%, classify the edge with Madrid's category. When multiple
Madrid categories overlap a single edge, prefer 'cycleway' over 'secondary'.

Never overwrites OSM tags; only writes to `edges.bike_infra`.
"""
from __future__ import annotations

import sys
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
MIN_OVERLAP_RATIO = 0.5  # fraction of edge length that must lie inside the buffer


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
            print("⏭️  Already SUCCESS for Madrid. Use --force to re-run.")
            return

        upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
        try:
            n_updated = enrich_madrid_edges(conn, city_id)
            conn.commit()
            upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)
            print(f"\n🎯 Done. {n_updated} edges enriched with bike_infra.")
        except Exception:
            conn.rollback()
            upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
            raise
    finally:
        conn.close()


def enrich_madrid_edges(conn, city_id: int) -> int:
    """
    Spatial-match Madrid bike-infra polylines to OSM edges and update
    edges.bike_infra. Returns number of edges updated.

    Strategy:
      1. Load Madrid features (reproject to EPSG:25830 — metric).
      2. Load Madrid edges from DB, project to 25830.
      3. Buffer each Madrid feature by BUFFER_M meters.
      4. Spatial-join: edges whose geometry intersects the buffer.
      5. For each candidate pair, compute overlap length / edge length.
         Keep if >= MIN_OVERLAP_RATIO.
      6. If an edge matches multiple Madrid features, prefer 'cycleway' over 'secondary'.
      7. Bulk UPDATE edges SET bike_infra = ... WHERE id IN (...).
    """
    import psycopg2.extras
    from shapely import wkb as shapely_wkb

    madrid_gdf = load_madrid_infra().to_crs(epsg=25830)

    print(f"  📡 Loading Madrid edges from DB (city_id={city_id})…")
    cur = conn.cursor()
    cur.execute(
        "SELECT id, ST_AsBinary(geom) AS wkb FROM edges WHERE city_id = %s",
        (city_id,),
    )
    rows = cur.fetchall()
    cur.close()
    print(f"     {len(rows):,} edges loaded.")

    edges_gdf = gpd.GeoDataFrame(
        {"id": [r[0] for r in rows]},
        geometry=[shapely_wkb.loads(bytes(r[1])) for r in rows],
        crs="EPSG:4326",
    ).to_crs(epsg=25830)
    edges_gdf["len_m"] = edges_gdf.geometry.length

    print(f"  🧮 Buffering Madrid features by {BUFFER_M}m and spatial-joining…")
    madrid_buffers = madrid_gdf.copy()
    madrid_buffers["geometry"] = madrid_buffers.geometry.buffer(BUFFER_M)

    joined = gpd.sjoin(
        edges_gdf,
        madrid_buffers[["bike_infra", "geometry"]],
        how="inner",
        predicate="intersects",
    )
    print(f"     {len(joined):,} candidate edge × buffer intersections.")

    if joined.empty:
        print("  ⚠️  No spatial matches; nothing to update.")
        return 0

    # Reattach buffer geometry so we can compute overlap fraction.
    joined = joined.reset_index().rename(columns={"index": "edge_idx"})
    buf_lookup = madrid_buffers[["geometry"]].rename(columns={"geometry": "buf_geom"})
    joined = joined.merge(buf_lookup, left_on="index_right", right_index=True, how="left")

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

    # Aggregate per edge: prefer 'cycleway' over 'secondary'.
    PRIORITY = {"cycleway": 1, "secondary": 0}
    matches["prio"] = matches["bike_infra"].map(PRIORITY)
    best = (
        matches.sort_values("prio", ascending=False)
        .drop_duplicates(subset=["id"], keep="first")[["id", "bike_infra"]]
    )
    print(f"     {len(best):,} unique edges to update.")

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

    for cat, count in best["bike_infra"].value_counts().items():
        print(f"     ✓ {cat:10}: {count:,} edges")

    return len(best)


if __name__ == "__main__":
    main()
