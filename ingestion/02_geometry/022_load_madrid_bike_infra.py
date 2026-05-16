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
    """Placeholder — implemented in Task 5."""
    raise NotImplementedError("Implemented in Task 5")


if __name__ == "__main__":
    main()
