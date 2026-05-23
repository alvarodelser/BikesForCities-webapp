"""
analyse_station_spikes.py
Run this to inspect reading intervals and delta distributions to calibrate
the truck-rebalancing spike threshold.

Usage:
    python backend/analyse_station_spikes.py [--city-id 1]
"""
import sys
import argparse
import datetime as dt
from pathlib import Path
import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv()
from backend.database.db_io import connect_db


def analyse(conn, city_id: int):
    with conn.cursor() as cur:
        cur.execute("""
            WITH consecutive AS (
                SELECT
                    station_id,
                    observed_at,
                    available_bikes,
                    COALESCE(available_bikes + empty_slots, NULL) AS capacity,
                    EXTRACT(EPOCH FROM (
                        observed_at - LAG(observed_at) OVER (PARTITION BY station_id ORDER BY observed_at)
                    )) AS interval_sec,
                    available_bikes - LAG(available_bikes) OVER (PARTITION BY station_id ORDER BY observed_at) AS delta
                FROM station_readings
                WHERE city_id = %s
                  AND observed_at >= NOW() - INTERVAL '3 months'
            )
            SELECT
                interval_sec,
                delta,
                capacity
            FROM consecutive
            WHERE interval_sec IS NOT NULL
              AND delta IS NOT NULL
              AND interval_sec > 0
              AND interval_sec <= 3600
        """, (city_id,))
        rows = cur.fetchall()

    if not rows:
        print("No data found.")
        return

    intervals = np.array([r[0] for r in rows], dtype=float)
    deltas    = np.array([r[1] for r in rows], dtype=float)
    caps      = np.array([r[2] if r[2] else np.nan for r in rows], dtype=float)

    abs_deltas = np.abs(deltas)
    delta_per_min = abs_deltas / (intervals / 60.0)

    print(f"\n{'='*60}")
    print(f"  City ID {city_id} — {len(rows):,} consecutive reading pairs")
    print(f"{'='*60}")

    print("\n── Reading intervals (seconds) ──")
    for p in [50, 75, 90, 95, 99, 99.9]:
        print(f"  p{p:<5}: {np.percentile(intervals, p):.0f}s")
    median_interval_min = np.median(intervals) / 60.0
    print(f"  Median interval: {np.median(intervals):.0f}s ({median_interval_min:.1f} min)")

    print("\n── |delta_bikes| distribution ──")
    for p in [50, 75, 90, 95, 99, 99.9]:
        print(f"  p{p:<5}: {np.percentile(abs_deltas, p):.1f} bikes")

    print("\n── |delta_bikes| / interval_min distribution ──")
    for p in [50, 75, 90, 95, 99, 99.9]:
        print(f"  p{p:<5}: {np.percentile(delta_per_min, p):.2f} bikes/min")

    valid_caps = caps[~np.isnan(caps)]
    if len(valid_caps) > 0:
        abs_deltas_with_cap = abs_deltas[~np.isnan(caps)]
        frac = abs_deltas_with_cap / valid_caps
        print("\n── |delta| / capacity distribution (where capacity known) ──")
        for p in [50, 75, 90, 95, 99, 99.9]:
            print(f"  p{p:<5}: {np.percentile(frac, p):.3f}")
        print(f"  (capacity coverage: {len(valid_caps)/len(rows)*100:.1f}% of readings)")

    print("\n── % of readings filtered at |delta| thresholds ──")
    for thresh in [2, 3, 4, 5, 6, 8, 10]:
        kept   = np.sum(abs_deltas <= thresh)
        pct_removed = (1 - kept / len(abs_deltas)) * 100
        print(f"  |delta| > {thresh:2d}  →  removes {pct_removed:.2f}% of readings")

    print("\n── % of readings filtered at bikes/min thresholds ──")
    for thresh in [0.5, 1.0, 1.5, 2.0, 3.0]:
        kept = np.sum(delta_per_min <= thresh)
        pct_removed = (1 - kept / len(delta_per_min)) * 100
        print(f"  delta/min > {thresh:.1f}  →  removes {pct_removed:.2f}% of readings")

    # Show how many unique stations contributed
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(DISTINCT station_id)
            FROM station_readings
            WHERE city_id = %s AND observed_at >= NOW() - INTERVAL '3 months'
        """, (city_id,))
        n_stations = cur.fetchone()[0]
    print(f"\n  Stations with data: {n_stations}")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--city-id", type=int, default=1)
    args = parser.parse_args()
    load_dotenv()
    conn = connect_db()
    analyse(conn, args.city_id)
    conn.close()


if __name__ == "__main__":
    main()
