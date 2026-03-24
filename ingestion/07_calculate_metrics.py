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

def calculate_skellam_trips(conn, city_id: int, metric_month: dt.datetime, period_end: dt.datetime) -> float:
    from scipy.special import ive
    from sklearn.linear_model import PoissonRegressor
    import pandas as pd
    import numpy as np
    from psycopg2.extras import execute_values

    query = """
        WITH diffs AS (
            SELECT
                station_id,
                observed_at,
                available_bikes - LAG(available_bikes) OVER (
                    PARTITION BY station_id
                    ORDER BY observed_at
                ) AS delta_bikes
            FROM station_readings
            WHERE city_id = %s
              AND observed_at >= %s
              AND observed_at < %s
        )
        SELECT station_id, observed_at, delta_bikes
        FROM diffs
        WHERE delta_bikes IS NOT NULL
    """
    with conn.cursor() as cur:
        cur.execute(query, (city_id, metric_month, period_end))
        rows = cur.fetchall()
        if not rows:
            return 0.0
        cols = [desc[0] for desc in cur.description]
        df = pd.DataFrame(rows, columns=cols)

    df['observed_at'] = pd.to_datetime(df['observed_at'], utc=True)
    
    hour = df['observed_at'].dt.hour + df['observed_at'].dt.minute / 60.0
    dayofweek = df['observed_at'].dt.dayofweek
    
    df['sin_d'] = np.sin(2 * np.pi * hour / 24.0)
    df['cos_d'] = np.cos(2 * np.pi * hour / 24.0)
    df['sin_w'] = np.sin(2 * np.pi * dayofweek / 7.0)
    df['cos_w'] = np.cos(2 * np.pi * dayofweek / 7.0)
    
    df['arr_target'] = np.maximum(0, df['delta_bikes'])
    df['dep_target'] = np.maximum(0, -df['delta_bikes'])
    
    features = ['sin_d', 'cos_d', 'sin_w', 'cos_w']
    
    lam_preds = pd.Series(0.0, index=df.index)
    mu_preds = pd.Series(0.0, index=df.index)
    
    station_groups = df.groupby('station_id')
    for station_id, group_indices in station_groups.groups.items():
        sub_df = df.loc[group_indices]
        if len(sub_df) < 10:
            lam_preds.loc[group_indices] = sub_df['dep_target'].mean()
            mu_preds.loc[group_indices] = sub_df['arr_target'].mean()
            continue
            
        X = sub_df[features]
        y_dep = sub_df['dep_target']
        y_arr = sub_df['arr_target']
        
        reg_dep = PoissonRegressor(alpha=1e-4, max_iter=300)
        reg_arr = PoissonRegressor(alpha=1e-4, max_iter=300)
        
        try:
            reg_dep.fit(X, y_dep)
            lam_preds.loc[group_indices] = reg_dep.predict(X)
        except Exception:
            lam_preds.loc[group_indices] = y_dep.mean()
            
        try:
            reg_arr.fit(X, y_arr)
            mu_preds.loc[group_indices] = reg_arr.predict(X)
        except Exception:
            mu_preds.loc[group_indices] = y_arr.mean()
            
    df['lam'] = lam_preds
    df['mu'] = mu_preds
    
    # Skellam correction
    z = 2 * np.sqrt(df['lam'] * df['mu'])
    abs_d = np.abs(df['delta_bikes'])
    
    ratio = np.zeros_like(z)
    mask = z > 1e-6
    ratio[mask] = ive(abs_d[mask] + 1, z[mask]) / ive(abs_d[mask], z[mask])
    
    df['expected_station_trips'] = z * ratio + abs_d
    
    # System-level trips per observed_at interval (divide by 2)
    agg_df = df.groupby('observed_at')['expected_station_trips'].sum() / 2.0
    agg_df = agg_df.reset_index(name='estimated_trips')
    
    if not agg_df.empty:
        rows_to_insert = [(city_id, row.observed_at, row.estimated_trips) for _, row in agg_df.iterrows()]
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO estimated_trips_per_interval (city_id, observed_at, estimated_trips)
                VALUES %s
                ON CONFLICT (city_id, observed_at) DO UPDATE SET
                    estimated_trips = EXCLUDED.estimated_trips
            """, rows_to_insert)
        conn.commit()
    
    return float(agg_df['estimated_trips'].sum())


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
            WHERE city_id = %s AND highway LIKE '%%cycleway%%'
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

        # 3. Monthly trips from Skellam metric calculation
        estimated_monthly_trips = calculate_skellam_trips(conn, city_id, metric_month, period_end)

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

