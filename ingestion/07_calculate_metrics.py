"""
07_calculate_metrics.py
Calculates monthly system-wide analytics for cities across all ingested domains
and upserts them into `city_metrics`.
"""

import datetime as dt
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[1]))
from backend.database.city_io import connect_db, get_all_cities


def month_start(d: dt.datetime) -> dt.datetime:
    return dt.datetime(d.year, d.month, 1, tzinfo=dt.timezone.utc)


def next_month(d: dt.datetime) -> dt.datetime:
    if d.month == 12:
        return dt.datetime(d.year + 1, 1, 1, tzinfo=dt.timezone.utc)
    return dt.datetime(d.year, d.month + 1, 1, tzinfo=dt.timezone.utc)


def get_city_months_with_station_data(conn, city_id: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT date_trunc('month', observed_at)::timestamptz AS m
            FROM station_readings
            WHERE city_id = %s
            ORDER BY m
            """,
            (city_id,),
        )
        return [row[0] for row in cur.fetchall()]


def calculate_monthly_metrics(conn, city_id: int, metric_month: dt.datetime):
    period_end = next_month(metric_month)

    with conn.cursor() as cur:
        # 1. Total Kilometers of bike paths
        cur.execute(
            """
            SELECT SUM(length) / 1000.0 
            FROM edges 
            WHERE city_id = %s AND highway LIKE '%cycleway%'
        """,
            (city_id,),
        )
        res = cur.fetchone()
        total_km = res[0] if res and res[0] else 0.0

        # 2. Coverage (bike path buildings / total buildings)
        cur.execute(
            """
            SELECT 
              (SELECT COUNT(*) FROM features WHERE city_id = %s AND feature_type = 'bike_path_buildings'),
              (SELECT COUNT(*) FROM features WHERE city_id = %s AND feature_type IN ('buildings', 'bike_path_buildings'))
        """,
            (city_id, city_id),
        )
        close_bldgs, total_bldgs = cur.fetchone()

        coverage = None
        if total_bldgs and total_bldgs > 0:
            coverage = float(close_bldgs) / float(total_bldgs)

        # 3. Rough monthly trips from station bike-count variation:
        #    estimate = sum(|delta available_bikes|) / 2 across all stations/timestamps in the month
        cur.execute(
            """
            WITH diffs AS (
                SELECT
                    station_id,
                    observed_at,
                    available_bikes,
                    available_bikes - LAG(available_bikes) OVER (
                        PARTITION BY station_id
                        ORDER BY observed_at
                    ) AS delta_bikes
                FROM station_readings
                WHERE city_id = %s
                  AND observed_at >= %s
                  AND observed_at < %s
            )
            SELECT COALESCE(SUM(ABS(delta_bikes)) / 2.0, 0.0)
            FROM diffs
            WHERE delta_bikes IS NOT NULL
        """,
            (city_id, metric_month, period_end),
        )
        estimated_monthly_trips = float(cur.fetchone()[0] or 0.0)

        # 4. Total stations active in this month
        cur.execute(
            """
            SELECT COUNT(DISTINCT station_id)
            FROM station_readings
            WHERE city_id = %s
              AND observed_at >= %s
              AND observed_at < %s
            """,
            (city_id, metric_month, period_end),
        )
        total_stations = int(cur.fetchone()[0] or 0)

        # Upsert metrics
        cur.execute(
            """
            INSERT INTO city_metrics (
                city_id, metric_month, coverage, total_kilometers,
                estimated_monthly_trips, total_stations, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (city_id, metric_month) DO UPDATE SET
                coverage = EXCLUDED.coverage,
                total_kilometers = EXCLUDED.total_kilometers,
                estimated_monthly_trips = EXCLUDED.estimated_monthly_trips,
                total_stations = EXCLUDED.total_stations,
                updated_at = NOW()
        """,
            (city_id, metric_month, coverage, total_km, estimated_monthly_trips, total_stations),
        )

    conn.commit()
    return total_km, coverage, estimated_monthly_trips, total_stations


def main():
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

    print(f"📊 Calculating monthly cross-domain metrics for {len(cities)} cities...\n")

    for city_id, name, _, _ in cities:
        months = get_city_months_with_station_data(conn, city_id)
        if not months:
            print(f"⏭️  {name}: no station history yet, skipping.")
            continue

        print(f"▶️  {name}: {len(months)} month(s) to process")
        for m in months:
            metric_month = month_start(m)
            km, cov, est_trips, total_stations = calculate_monthly_metrics(conn, city_id, metric_month)

            cov_str = f"{cov*100:.1f}%" if cov is not None else "N/A"
            print(
                f"   ✔ {metric_month:%Y-%m} | coverage: {cov_str} | "
                f"bike lanes: {km:.1f}km | est trips: {est_trips:.0f} | stations: {total_stations}"
            )

    print("\n🏁 Finished calculating all metrics.")
    conn.close()


if __name__ == "__main__":
    main()

