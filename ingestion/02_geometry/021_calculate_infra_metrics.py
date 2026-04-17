"""
11_calculate_infrastructure_coverage.py
Calculates static (non-monthly) infrastructure coverage and total KM for all cities.
"""
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io.connection import connect_db
from backend.database.db_io.cities import get_all_cities, upsert_ingestion_status, get_ingestion_status, check_prerequisites
from backend.database.db_io.metrics import calculate_osm_metrics

def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Calculate infrastructure coverage")
    parser.add_argument("--city", help="City name (optional, runs for all if omitted)")
    parser.add_argument("--force", action="store_true", help="Force re-computation even if already SUCCESS")
    args = parser.parse_args()

    try:
        conn = connect_db()
    except Exception as e:
        print(f"❌ DB Connection failed: {e}")
        return

    cities = get_all_cities(conn)
    
    target_cities = []
    if args.city:
        target_cities = [c for c in cities if c[1].lower() == args.city.lower()]
        if not target_cities:
            print(f"❌ City '{args.city}' not found.")
            return
    else:
        target_cities = cities

    print(f"📊 Calculating infrastructure coverage for {len(target_cities)} cities...\n")

    for city_row in target_cities:
        city_id, name, _, _, center_lat, center_lon, _, angle, *rest = city_row

        missing = check_prerequisites(conn, ["020_load_osm"], city_id=city_id)
        if missing:
            print(f"⚠️  Skipping '{name}': prerequisites not met: {missing}")
            continue

        pname = "021_calculate_infra_metrics"
        status_obj = get_ingestion_status(conn, pname, city_id=city_id)
        if status_obj and status_obj.get("status") == "SUCCESS" and not args.force:
            print(f"⏭️  Skipping {name}: infrastructure coverage already computed. Use --force to override.")
            continue
            
        upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
        try:
            total_km, coverage = calculate_osm_metrics(conn, city_id, center_lat, center_lon, angle)
            
            # Upsert into city_metrics as a static entry or update existing rows
            with conn.cursor() as cur:
                # We update all existing metrics for this city with the newly calculated values
                cur.execute("""
                    UPDATE city_metrics
                    SET coverage = %s, total_kilometers = %s, updated_at = NOW()
                    WHERE city_id = %s
                """, (coverage, total_km, city_id))
                
                # If no rows were updated (no metric months exist yet), insert a baseline row
                if cur.rowcount == 0:
                    cur.execute("""
                        INSERT INTO city_metrics (city_id, metric_month, coverage, total_kilometers, updated_at)
                        VALUES (%s, NOW(), %s, %s, NOW())
                    """, (city_id, coverage, total_km))
            
            conn.commit()
            
            cov_str = f"{coverage*100:.1f}%" if coverage is not None else "N/A"
            print(f"  ✔ {name} | coverage: {cov_str} | bike lanes: {total_km:.1f}km")
            
            upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)
        except Exception as e:
            upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
            print(f"❌ Error calculating infrastructure for {name}: {e}")

    print("\n🏁 Finished calculating infrastructure coverage.")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
