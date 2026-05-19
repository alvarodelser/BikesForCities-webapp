"""
07_calculate_metrics.py
Calculates monthly system-wide analytics for cities across all ingested domains
and upserts them into `city_metrics`.
"""

import datetime as dt
import sys
import argparse
from pathlib import Path
from typing import Tuple

from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import (
    connect_db, get_all_cities,
    get_skellam_readings_diffs, get_station_merge_map, get_citybikes_network_id,
    upsert_station_monthly, upsert_station_monthly_demand, upsert_estimated_trips_interval,
    get_city_months_with_station_data, get_total_active_stations, upsert_city_metrics,
)
from backend.database.db_io.cities import upsert_ingestion_status, get_ingestion_status, check_prerequisites, get_city_center
from backend.database.db_io.metrics import get_city_bicycles_count

def calculate_skellam_trips(conn, city_id: int, metric_month: dt.datetime, period_end: dt.datetime) -> Tuple[float, float]:
    from scipy.special import ive
    from sklearn.linear_model import PoissonRegressor
    import pandas as pd
    import numpy as np
    from psycopg2.extras import execute_values

    rows, cols = get_skellam_readings_diffs(conn, city_id, metric_month, period_end)
    if not rows:
        return 0.0, 0.0
    df = pd.DataFrame(rows, columns=cols)

    df['observed_at'] = pd.to_datetime(df['observed_at'], utc=True)
    if 'interval_sec' in df.columns:
        df['interval_sec'] = df['interval_sec'].apply(lambda x: float(x) if x is not None else None)
    
    # --- Downtime calculation ---
    # We sort by station and time to compute intervals
    df = df.sort_values(['station_id', 'observed_at'])
    # We NO LONGER fill with period_end to avoid future extrapolation.
    # We only care about observed intervals.
    df['next_observed_at'] = df.groupby('station_id')['observed_at'].shift(-1)
    
    df['duration_sec'] = (df['next_observed_at'] - df['observed_at']).dt.total_seconds()
    
    # Handle gaps: anything > 1 hour (3600s) is an outlier and should be discarded
    # Data analysis showed p99 is 45 minutes, so 1 hour is a safe threshold.
    MAX_GAP = 3600 
    df['is_valid_interval'] = (df['duration_sec'] > 0) & (df['duration_sec'] <= MAX_GAP)
    
    df['is_down'] = (df['available_bikes'] <= 2).astype(float)
    df['valid_duration_sec'] = df['duration_sec'].where(df['is_valid_interval'], 0)
    df['valid_downtime_sec'] = (df['is_down'] * df['duration_sec']).where(df['is_valid_interval'], 0)
    
    # Count readings per station to filter out low-confidence data (min 50 readings)
    station_counts = df.groupby('station_id').size()
    valid_stations = station_counts[station_counts >= 50].index
    
    station_downtime = df[df['station_id'].isin(valid_stations)].groupby('station_id').agg({
        'valid_downtime_sec': 'sum',
        'valid_duration_sec': 'sum'
    })
    
    # Downtime as average minutes per day: (total_down / total_observed) * 1440
    station_downtime['downtime_minutes'] = 0.0
    mask = station_downtime['valid_duration_sec'] > 0
    station_downtime.loc[mask, 'downtime_minutes'] = (
        station_downtime.loc[mask, 'valid_downtime_sec'] / station_downtime.loc[mask, 'valid_duration_sec']
    ) * 1440.0
    station_downtime = station_downtime.reset_index()
    # --- End Downtime calculation ---

    # For Skellam, we still need delta_bikes not null
    skellam_df = df[df['delta_bikes'].notnull()].copy()

    # Filter out truck rebalancing events — only applied to Skellam.
    # Downtime is unaffected: a truck moving bikes legitimately ends a downtime period.
    if 'interval_sec' in skellam_df.columns:
        # Drop long-gap intervals from Skellam (same 1-hour cap as downtime)
        skellam_df = skellam_df[
            (skellam_df['interval_sec'] > 0) & (skellam_df['interval_sec'] <= 3600)
        ]
        if not skellam_df.empty:
            rate = skellam_df['delta_bikes'].abs() / (skellam_df['interval_sec'] / 60.0)
            # Per-city threshold: p99 of the bikes/min rate distribution.
            # Trucks visit each station ~1×/day = ~0.35% of readings, so p99 (top 1%)
            # catches all truck events with room to spare for multi-visit days.
            truck_threshold = float(np.quantile(rate, 0.99)) if len(rate) >= 100 else np.inf
            skellam_df = skellam_df[rate <= truck_threshold]

    if skellam_df.empty:
        # If no deltas, we can't do Skellam, but we might have downtime
        avg_downtime = station_downtime['downtime_minutes'].mean() if not station_downtime.empty else 0.0
        # Update stations with downtime even if trips can't be calculated
        # (Handling this below)
        pass
    else:
        df = skellam_df # Continue with skellam_df for the rest of the original logic
    
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

    # Hourly profile grid: 24 hours × 7 days, averaged across days to give per-hour demand
    _hours = np.arange(24)
    _days = np.arange(7)
    _hd = np.array([(h, d) for h in _hours for d in _days])
    _h2pi = 2 * np.pi * _hd[:, 0] / 24.0
    _d2pi = 2 * np.pi * _hd[:, 1] / 7.0
    X_profile = np.column_stack([np.sin(_h2pi), np.cos(_h2pi), np.sin(_d2pi), np.cos(_d2pi)])

    demand_profile_rows: list = []

    station_groups = df.groupby('station_id')
    for station_id, group_indices in station_groups.groups.items():
        sub_df = df.loc[group_indices]
        if len(sub_df) < 10:
            mean_dep = sub_df['dep_target'].mean()
            mean_arr = sub_df['arr_target'].mean()
            lam_preds.loc[group_indices] = mean_dep
            mu_preds.loc[group_indices] = mean_arr
            # Flat profile for low-data stations
            for h in _hours:
                demand_profile_rows.append((station_id, int(h), float(mean_dep), float(mean_arr)))
            continue

        X = sub_df[features]
        y_dep = sub_df['dep_target']
        y_arr = sub_df['arr_target']

        reg_dep = PoissonRegressor(alpha=1e-4, max_iter=300)
        reg_arr = PoissonRegressor(alpha=1e-4, max_iter=300)

        lam_profile = np.full(24, y_dep.mean())
        mu_profile = np.full(24, y_arr.mean())

        try:
            reg_dep.fit(X, y_dep)
            lam_preds.loc[group_indices] = reg_dep.predict(X)
            lam_profile = reg_dep.predict(X_profile).reshape(24, 7).mean(axis=1)
        except Exception:
            lam_preds.loc[group_indices] = y_dep.mean()

        try:
            reg_arr.fit(X, y_arr)
            mu_preds.loc[group_indices] = reg_arr.predict(X)
            mu_profile = reg_arr.predict(X_profile).reshape(24, 7).mean(axis=1)
        except Exception:
            mu_preds.loc[group_indices] = y_arr.mean()

        for h, lam_h, mu_h in zip(_hours, lam_profile, mu_profile):
            demand_profile_rows.append((station_id, int(h), float(lam_h), float(mu_h)))
            
    df['lam'] = lam_preds
    df['mu'] = mu_preds
    
    # Skellam correction
    z = 2 * np.sqrt(df['lam'] * df['mu'])
    abs_d = np.abs(df['delta_bikes'])
    
    ratio = np.zeros_like(z)
    mask = z > 1e-6
    ratio[mask] = ive(abs_d[mask] + 1, z[mask]) / ive(abs_d[mask], z[mask])
    
    df['expected_station_trips'] = z * ratio + abs_d
    
    # Map each station to its representative (merging clusters)
    station_map = get_station_merge_map(conn, city_id)
    
    df['rep_station_id'] = df['station_id'].map(station_map).fillna(df['station_id'])
    
    # Per-station metrics: aggregate trips, inbound (arrivals), outbound (departures)
    station_agg = df.groupby('rep_station_id').agg(
        expected_station_trips=('expected_station_trips', 'sum'),
        estimated_inbound=('arr_target', 'sum'),
        estimated_outbound=('dep_target', 'sum'),
    ).reset_index()
    station_agg.columns = ['station_id', 'expected_station_trips', 'estimated_inbound', 'estimated_outbound']
    
    # Merge downtime info
    station_downtime['rep_station_id'] = station_downtime['station_id'].map(station_map).fillna(station_downtime['station_id'])
    rep_downtime = station_downtime.groupby('rep_station_id').agg(
        valid_downtime_sec=('valid_downtime_sec', 'sum'),
        valid_duration_sec=('valid_duration_sec', 'sum'),
    )
    
    rep_downtime['downtime_minutes'] = 0.0
    mask = rep_downtime['valid_duration_sec'] > 0
    rep_downtime.loc[mask, 'downtime_minutes'] = (
        rep_downtime.loc[mask, 'valid_downtime_sec'] / rep_downtime.loc[mask, 'valid_duration_sec']
    ) * 1440.0
    rep_downtime = rep_downtime.reset_index()
    
    station_agg = station_agg.merge(
        rep_downtime[['rep_station_id', 'downtime_minutes', 'valid_duration_sec']], 
        left_on='station_id', right_on='rep_station_id', how='outer'
    )
    station_agg['station_id'] = station_agg['station_id'].fillna(station_agg['rep_station_id'])
    station_agg['expected_station_trips'] = station_agg['expected_station_trips'].fillna(0)
    station_agg['estimated_inbound'] = station_agg['estimated_inbound'].fillna(0)
    station_agg['estimated_outbound'] = station_agg['estimated_outbound'].fillna(0)
    
    # SCALE TRIPS: If we only observed a fraction of the month, scale to the full month
    month_days = (next_month(metric_month) - metric_month).days
    if month_days == 0: month_days = 30
    month_seconds = month_days * 86400
    
    def scale_trips(row):
        obs = row['valid_duration_sec']
        if obs > 0 and obs < month_seconds:
            factor = min(10.0, month_seconds / obs)
            return row['expected_station_trips'] * factor, row['estimated_inbound'] * factor, row['estimated_outbound'] * factor
        return row['expected_station_trips'], row['estimated_inbound'], row['estimated_outbound']
        
    scaled = station_agg.apply(scale_trips, axis=1, result_type='expand')
    station_agg['expected_station_trips'] = scaled[0]
    station_agg['estimated_inbound'] = scaled[1]
    station_agg['estimated_outbound'] = scaled[2]
    
    # Get citybikes_network_id for the city
    network_id = get_citybikes_network_id(conn, city_id)
    month_date = metric_month.date() if hasattr(metric_month, 'date') else metric_month
        
    if not station_agg.empty and network_id:
        station_rows = [
            (city_id, network_id, row.station_id, month_date,
             row.expected_station_trips, row.estimated_inbound, row.estimated_outbound,
             row.downtime_minutes if row.downtime_minutes == row.downtime_minutes else 0.0)
            for _, row in station_agg.iterrows()
        ]
        upsert_station_monthly(conn, station_rows)

    # Store per-station hourly demand profiles aggregated by rep_station_id (consistent with station_monthly)
    if demand_profile_rows and network_id:
        from collections import defaultdict
        rep_demand: dict = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
        for (sid, hour, lam, mu) in demand_profile_rows:
            rep = station_map.get(sid, sid)
            rep_demand[rep][hour][0] += lam
            rep_demand[rep][hour][1] += mu
        demand_db_rows = [
            (city_id, network_id, rep_sid, month_date, hour, vals[0], vals[1])
            for rep_sid, hour_map in rep_demand.items()
            for hour, vals in hour_map.items()
        ]
        upsert_station_monthly_demand(conn, demand_db_rows)
        
    # System-level trips per observed_at interval (divide by 2)
    agg_df = df.groupby('observed_at')['expected_station_trips'].sum() / 2.0
    agg_df = agg_df.reset_index(name='estimated_trips')
        
    if not agg_df.empty:
        rows_to_insert = [(city_id, row.observed_at, row.estimated_trips) for _, row in agg_df.iterrows()]
        upsert_estimated_trips_interval(conn, rows_to_insert)
    
    conn.commit()
    avg_city_downtime = float(rep_downtime['downtime_minutes'].mean()) if not rep_downtime.empty else 0.0
    return float(agg_df['estimated_trips'].sum()), avg_city_downtime


def month_start(d: dt.datetime) -> dt.datetime:
    return dt.datetime(d.year, d.month, 1, tzinfo=dt.timezone.utc)


def next_month(d: dt.datetime) -> dt.datetime:
    if d.month == 12:
        return dt.datetime(d.year + 1, 1, 1, tzinfo=dt.timezone.utc)
    return dt.datetime(d.year, d.month + 1, 1, tzinfo=dt.timezone.utc)


def get_city_months_with_station_data_wrapper(conn, city_id: int):
    return get_city_months_with_station_data(conn, city_id)


def calculate_monthly_metrics(conn, city_id: int, metric_month: dt.datetime):
    period_end = next_month(metric_month)

    estimated_monthly_trips, station_downtime = calculate_skellam_trips(conn, city_id, metric_month, period_end)
    total_stations = get_total_active_stations(conn, city_id, metric_month, period_end)
    bicycles_count = get_city_bicycles_count(conn, city_id, metric_month, period_end)

    upsert_city_metrics(
        conn, city_id, metric_month,
        coverage=None, total_km=None,
        estimated_monthly_trips=estimated_monthly_trips,
        total_stations=total_stations,
        station_downtime=station_downtime,
        bicycles_count=bicycles_count,
    )

    conn.commit()
    return estimated_monthly_trips, total_stations, station_downtime


def main():
    parser = argparse.ArgumentParser(description="Calculate cross-domain metrics")
    parser.add_argument("--force", action="store_true", help="Force re-computation even if month already processed")
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
        conn.commit()
        conn.close()
        return

    print(f"📊 Calculating monthly cross-domain metrics for {len(cities)} cities...\n")

    for city_row in cities:
        city_id, name = city_row[0], city_row[1]

        missing = check_prerequisites(conn, ["030_load_stations"], city_id=city_id)
        if missing:
            print(f"⚠️  Skipping '{name}': prerequisites not met: {missing}")
            continue

        pname = "031_calculate_traffic"
        upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
        try:
            months = get_city_months_with_station_data(conn, city_id)
            if not months:
                months = [month_start(dt.datetime.now(dt.timezone.utc))]
                print(f"▶️  {name}: no station history, calculating blank metrics for current month.")
            else:
                print(f"▶️  {name}: {len(months)} month(s) to process")

            skipped_count = 0
            for m in months:
                metric_month = month_start(m)
                month_str = metric_month.strftime("%Y-%m-%d")

                month_status = get_ingestion_status(conn, pname, city_id=city_id, time_period=month_str)
                if month_status and month_status.get("status") == "SUCCESS" and not args.force:
                    skipped_count += 1
                    continue

                if skipped_count > 0:
                    print(f"   ⏭️  Skipped {skipped_count} months (already computed)")
                    skipped_count = 0

                upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id, time_period=month_str)
                est_trips, total_stations, downtime = calculate_monthly_metrics(conn, city_id, metric_month)

                print(
                    f"   ✔ {metric_month:%Y-%m} | trips: {est_trips:.0f} | stations: {total_stations} | downtime: {downtime:.1f}m"
                )
                upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id, time_period=month_str)

            if skipped_count > 0:
                print(f"   ⏭️  Skipped {skipped_count} months (already computed)")

            upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)
        except Exception as e:
            upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
            print(f"❌ Error calculating metrics for {name}: {e}")

    print("\n🏁 Finished calculating all metrics.")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()

