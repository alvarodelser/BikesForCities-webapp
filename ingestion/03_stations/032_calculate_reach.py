"""
032_calculate_reach.py
Pre-computes station reachability coverage for all cities.

Coverage = area of convex hull of reachable endpoints / area of geodesic circle
at max_distance (default 1 km).  Result is stored in stations.reach_coverage.
"""

import sys
import argparse
from pathlib import Path

from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import (
    connect_db, get_all_cities,
    compute_all_reach_coverages, update_station_reach_coverage,
    compute_station_building_coverages, update_city_station_coverage,
    get_ingestion_status, check_prerequisites,
)
from backend.database.db_io.cities import upsert_ingestion_status


MAX_DISTANCE = 1000.0  # metres


def main():
    parser = argparse.ArgumentParser(description="Compute station reachability")
    parser.add_argument("--force", action="store_true", help="Force re-computation even if already SUCCESS")
    args = parser.parse_args()

    load_dotenv()

    try:
        conn = connect_db()
    except Exception as e:
        print(f"❌ DB Connection failed: {e}")
        return

    cities = get_all_cities(conn)
    if not cities:
        print("❌ No cities found.")
        conn.close()
        return

    print(f"📡 Computing station reachability for {len(cities)} cities…\n")

    for city_id, name, *_rest in cities:
        missing = check_prerequisites(conn, ["020_load_osm", "030_load_stations"], city_id=city_id)
        if missing:
            print(f"⚠️  Skipping '{name}': prerequisites not met: {missing}")
            continue

        pname = "032_calculate_reach"
        status_obj = get_ingestion_status(conn, pname, city_id=city_id)
        if status_obj and status_obj.get("status") == "SUCCESS" and not args.force:
            print(f"⏭️  Skipping {name}: reach coverage already computed. Use --force to override.")
            continue
            
        upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
        try:
            coverages = compute_all_reach_coverages(conn, city_id, MAX_DISTANCE)
            if not coverages:
                print(f"⏭️  {name}: no stations or edges — skipped")
                upsert_ingestion_status(conn, pname, "SKIPPED", city_id=city_id)
                continue

            update_station_reach_coverage(conn, city_id, coverages)

            compute_station_building_coverages(conn, city_id)
            
            print(f"   ▶️  Computing city-wide station coverage (study area)…")
            update_city_station_coverage(conn, city_id)
            conn.commit()

            vals = list(coverages.values())
            avg = sum(vals) / len(vals) if vals else 0
            print(
                f"   ✔ {name}: {len(coverages)} stations | "
                f"avg reach {avg:.1f}% | "
                f"min {min(vals):.1f}% | max {max(vals):.1f}%"
            )
            upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)
        except Exception as e:
            upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
            print(f"❌ Error for {name}: {e}")
            import traceback
            traceback.print_exc()

    print("\n🏁 Finished computing reachability for all cities.")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
