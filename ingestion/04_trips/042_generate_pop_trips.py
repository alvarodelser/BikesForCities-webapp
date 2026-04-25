"""
042_generate_pop_trips.py
Generates synthetic trips from building footprints and population density.

Algorithm (planned):
1. Load building footprints from the features table (feature_type='building').
2. Load population density raster or polygon data (e.g. from WorldPop/Eurostat).
3. For each city, estimate trip generation at each building / density cell
   proportional to population weight.
4. Pair origins and destinations using a gravity model calibrated against
   the trip-distance histogram from real Madrid trips (same as 041).
5. Write O-D pairs as trips (generation_type='buildings_population').
   Path computation is deferred to 050_compute_shortest_paths.py.

Status: STUB – data ingestion pipeline for population rasters is not yet
implemented. The script structure mirrors 041_generate_station_trips.py so
it can be filled in without touching anything else.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io import (
    connect_db,
    get_all_cities,
    upsert_ingestion_status,
    check_prerequisites,
)

PROCESS_NAME = "042_generate_pop_trips"


def generate_for_city(conn, city_id: int, city_name: str, force: bool = False) -> None:
    print(f"\n  🏙️  [STUB] Population-based trip generation for {city_name}")
    print("     ⚠️  Not yet implemented – population raster ingestion required.")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="Generate population-density-based synthetic trips (stub)"
    )
    parser.add_argument("--city", help="City name (optional – runs all eligible cities)")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    try:
        conn = connect_db()
    except Exception as e:
        print(f"❌ DB Connection failed: {e}")
        return

    cities = get_all_cities(conn)
    target = (
        [c for c in cities if c[1].lower() == args.city.lower()]
        if args.city
        else cities
    )

    for city_row in target:
        city_id, city_name = city_row[0], city_row[1]
        missing = check_prerequisites(conn, ["020_load_osm"], city_id=city_id)
        if missing:
            print(f"⚠️  Skipping '{city_name}': prerequisites not met: {missing}")
            continue
        upsert_ingestion_status(conn, PROCESS_NAME, "SKIPPED", city_id=city_id)
        generate_for_city(conn, city_id, city_name, force=args.force)

    print("\n🏁 Population-based trip generation finished (stub – no data written).")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
