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
from backend.database.db_io.cities import get_all_cities, upsert_ingestion_status
from backend.database.db_io.metrics import calculate_osm_metrics

def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Calculate infrastructure coverage")
    parser.add_argument("--city", help="City name (optional, runs for all if omitted)")
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
        upsert_ingestion_status(conn, city_id, "infrastructure coverage", "RUNNING")
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
            
            upsert_ingestion_status(conn, city_id, "infrastructure coverage", "SUCCESS")
        except Exception as e:
            upsert_ingestion_status(conn, city_id, "infrastructure coverage", "FAILED")
            print(f"❌ Error calculating infrastructure for {name}: {e}")

    print("\n🏁 Finished calculating infrastructure coverage.")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
