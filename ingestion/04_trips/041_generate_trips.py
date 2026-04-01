"""
041_generate_trips.py
Generates synthetic trips for cities that don't have real trip CSV data.

Algorithm:
1. Build trip-distance histogram from Madrid real trips (calibration).
2. For each city/month with station_monthly flows but no real routes:
   a. Load per-station inbound/outbound estimates.
   b. Compute Haversine distance matrix between stations.
   c. Build weight matrix W[i,j] = P(dist[i,j]) using histogram lookup.
   d. Solve balanced OD flow with Sinkhorn-Knopp so row sums = outbound,
      col sums = inbound.
   e. Write integer-rounded trips as synthetic routes to DB.
3. Update ingestion_status.
"""

from __future__ import annotations

import argparse
import sys
import uuid
import datetime as dt
import math
import random
from collections import Counter
from pathlib import Path
from typing import List, Tuple

import numpy as np
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io import (
    connect_db,
    get_all_cities,
    upsert_ingestion_status,
    get_ingestion_status,
    get_station_monthly_flow,
    get_city_months_with_station_data,
)
from backend.database.db_io.routes import put_routes


# ── Helpers ───────────────────────────────────────────────────────────────────

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in metres between two WGS-84 points."""
    R = 6_371_000.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def build_trip_distance_histogram(conn, madrid_city_id: int, bin_m: int = 200) -> Tuple[np.ndarray, np.ndarray]:
    """
    Derive a normalized trip-distance histogram from Madrid real routes.
    Uses ST_Length on the path geometry of completed routes.

    Returns (bin_edges, probabilities) – arrays of length n+1 and n.
    """
    print("  📐 Deriving trip-distance histogram from Madrid real trips …")
    with conn.cursor() as cur:
        # Approximate trip distance from trip_minutes via median speed of ~12 km/h
        # (actual graph paths would be better but expensive; minutes is a good proxy)
        cur.execute("""
            SELECT trip_minutes
            FROM routes
            WHERE city_id = %s
              AND trip_minutes IS NOT NULL
              AND trip_minutes > 0
              AND trip_minutes < 120
            LIMIT 200000
        """, (madrid_city_id,))
        rows = cur.fetchall()

    if not rows:
        # Fallback: uniform 0–5 km distribution
        edges = np.arange(0, 5200, bin_m, dtype=float)
        probs = np.ones(len(edges) - 1) / (len(edges) - 1)
        return edges, probs

    # Convert minutes → approximate distance in metres at 12 km/h = 200 m/min
    distances_m = np.array([r[0] * 200.0 for r in rows])
    max_d = np.percentile(distances_m, 99)
    edges = np.arange(0, max_d + bin_m, bin_m, dtype=float)
    counts, _ = np.histogram(distances_m, bins=edges)
    probs = counts / counts.sum()
    return edges, probs


def hist_weight(dist_m: float, edges: np.ndarray, probs: np.ndarray) -> float:
    """Look up histogram probability for a given distance."""
    idx = np.searchsorted(edges, dist_m, side='right') - 1
    if 0 <= idx < len(probs):
        return float(probs[idx])
    return 0.0


def sinkhorn_knopp(W: np.ndarray, row_sums: np.ndarray, col_sums: np.ndarray,
                   max_iter: int = 100, tol: float = 1e-4) -> np.ndarray:
    """
    Iterative Sinkhorn-Knopp scaling to produce a matrix T s.t.
    T @ 1 ≈ row_sums  and  1 @ T ≈ col_sums.
    Rows and columns with zero marginals are left as zero.
    """
    T = W.copy().astype(float)
    for _ in range(max_iter):
        # Row scaling
        row_sum = T.sum(axis=1)
        row_safe = np.where(row_sum > 0, row_sum, 1.0)
        T = T * (row_sums / row_safe)[:, None]
        # Column scaling
        col_sum = T.sum(axis=0)
        col_safe = np.where(col_sum > 0, col_sum, 1.0)
        T = T * (col_sums / col_safe)[None, :]
        # Convergence
        if np.max(np.abs(T.sum(axis=1) - row_sums)) < tol:
            break
    return T


def nearest_node_for_station(conn, city_id: int, lat: float, lon: float) -> int | None:
    """Return the nearest graph node id to a given lat/lon."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id FROM nodes
            WHERE city_id = %s
            ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            LIMIT 1
        """, (city_id, float(lon), float(lat)))
        row = cur.fetchone()
        return row[0] if row else None


def city_has_real_routes(conn, city_id: int) -> bool:
    """Return True if the city already has real (non-synthetic) routes."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 1 FROM routes
            WHERE city_id = %s AND strategy != 'station-based synthetic'
            LIMIT 1
        """, (city_id,))
        return cur.fetchone() is not None


def city_months_with_flow(conn, city_id: int) -> List[dt.date]:
    """Return distinct months in station_monthly for a city."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT metric_month
            FROM station_monthly
            WHERE city_id = %s
            ORDER BY metric_month
        """, (city_id,))
        return [row[0] for row in cur.fetchall()]


def month_start_ts(d: dt.date) -> dt.datetime:
    return dt.datetime(d.year, d.month, 1, tzinfo=dt.timezone.utc)


def spread_timestamps(month: dt.date, n: int) -> List[dt.datetime]:
    """Spread n synthetic trip timestamps uniformly across the month."""
    start = month_start_ts(month)
    if month.month == 12:
        end = dt.datetime(month.year + 1, 1, 1, tzinfo=dt.timezone.utc)
    else:
        end = dt.datetime(month.year, month.month + 1, 1, tzinfo=dt.timezone.utc)
    duration = (end - start).total_seconds()
    return [
        start + dt.timedelta(seconds=duration * i / n)
        for i in range(n)
    ]


# ── Main ──────────────────────────────────────────────────────────────────────

def generate_for_city(conn, city_id: int, city_name: str,
                      edges: np.ndarray, probs: np.ndarray,
                      min_trips_threshold: float = 0.5) -> None:
    """Run synthetic trip generation for one city."""
    print(f"\n  🏙️  Generating synthetic trips for {city_name} …")

    months = city_months_with_flow(conn, city_id)
    if not months:
        print(f"     ⚠️  No station_monthly data found. Run 031_calculate_traffic.py first.")
        return

    # Cache node IDs for stations across months
    node_cache: dict[str, int | None] = {}
    all_route_rows = []

    status_obj = get_ingestion_status(conn, city_id, "synthetic trips")
    details = (status_obj.get("details") or {}) if status_obj else {}
    processed_months = details.setdefault("processed_months", [])

    for month in months:
        month_str = month.strftime("%Y-%m-%d")
        if month_str in processed_months:
            print(f"     ⏭️  Skipping {month}: station-based synthetic trips already in ingestion_status.")
            continue

        flow_rows = get_station_monthly_flow(conn, city_id, month)
        # flow_rows: (station_id, network_id, lat, lon, inbound, outbound)
        if len(flow_rows) < 2:
            continue

        station_ids = [r[0] for r in flow_rows]
        network_ids = [r[1] for r in flow_rows]
        lats = np.array([r[2] for r in flow_rows], dtype=float)
        lons = np.array([r[3] for r in flow_rows], dtype=float)
        inbound = np.array([max(0.0, r[4] or 0) for r in flow_rows], dtype=float)
        outbound = np.array([max(0.0, r[5] or 0) for r in flow_rows], dtype=float)

        n = len(station_ids)

        # 1. Ensure cached graph nodes
        for sid, lat, lon in zip(station_ids, lats, lons):
            if sid not in node_cache:
                node_cache[sid] = nearest_node_for_station(conn, city_id, lat, lon)

        # 2. Match exact outbound/inbound sums using integer rounding
        outbound_int = np.round(outbound).astype(int)
        inbound_int = np.round(inbound).astype(int)

        diff = inbound_int.sum() - outbound_int.sum()
        if diff > 0:
            valid_idx = np.where(inbound_int > 0)[0]
            if len(valid_idx) > 0:
                to_remove = np.random.choice(valid_idx, size=diff, replace=True)
                for idx in to_remove:
                    if inbound_int[idx] > 0:
                        inbound_int[idx] -= 1
        elif diff < 0:
            to_add = np.random.choice(n, size=-diff, replace=True)
            for idx in to_add:
                inbound_int[idx] += 1

        num_trips = outbound_int.sum()
        if num_trips < 1:
            continue

        # 3. Create flat randomized departures list
        departures = np.repeat(np.arange(n), outbound_int)
        np.random.shuffle(departures)
        
        # Track unassigned returns
        avail_in = inbound_int.copy().astype(float)

        # 4. Precompute distance weights using calibration histogram
        W = np.zeros((n, n), dtype=float)
        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                d = haversine_m(lats[i], lons[i], lats[j], lons[j])
                W[i, j] = hist_weight(d, edges, probs)

        # 5. Assign trips one carefully matching each departure 
        # with an available return weighted by distance + availability
        month_trips_raw = []
        for src in departures:
            w = W[src, :] * avail_in
            s = w.sum()
            if s > 0:
                dst = random.choices(range(n), weights=w.tolist(), k=1)[0]
            else:
                valid = np.where(avail_in > 0)[0]
                if len(valid) == 0:
                    continue
                dst = random.choice(valid.tolist())
            
            avail_in[dst] -= 1
            month_trips_raw.append((src, dst))

        # 6. Aggregate into OD pairs to use established flow
        od_counts = Counter(month_trips_raw)
        month_trips = []
        for (src, dst), count in od_counts.items():
            origin_node = node_cache.get(station_ids[src])
            dest_node = node_cache.get(station_ids[dst])
            if origin_node is None or dest_node is None:
                continue
            month_trips.append((
                origin_node, dest_node, count,
                lats[src], lons[src], lats[dst], lons[dst]
            ))

        if not month_trips:
            continue

        # Expand into individual route rows
        timestamps = spread_timestamps(month, sum(t[2] for t in month_trips))
        ts_idx = 0
        for origin_node, dest_node, n_trips, o_lat, o_lon, d_lat, d_lon in month_trips:
            for _ in range(n_trips):
                ts = timestamps[ts_idx] if ts_idx < len(timestamps) else timestamps[-1]
                ts_idx += 1
                trip_id = f"synthetic_{city_id}_{month}_{uuid.uuid4().hex[:12]}"
                
                all_route_rows.append(
                    (city_id, trip_id, origin_node, dest_node, "station-based synthetic", None, 
                     ts, None, float(o_lat), float(o_lon), float(d_lat), float(d_lon), None)
                )
                # Instead of immediate batching, we just collect them all in memory 
                # (1.5M rows is easily kept in python memory, we batch only the DB insertions below)

        print(f"     {month}: {len(month_trips)} OD pairs → {sum(t[2] for t in month_trips):,} synthetic trips")
        
        if all_route_rows:
            try:
                print(f"  💾 Writing transaction for {len(all_route_rows):,} synthetic routes …")
                with conn: # implicit transaction block for the entire month
                    for i in range(0, len(all_route_rows), 50_000):
                        batch = all_route_rows[i:i+50_000]
                        put_routes(conn, batch, commit=False)
                
                # Transaction implicitly commits here.
                # Now record the success in ingestion_status
                processed_months.append(month_str)
                details["processed_months"] = processed_months
                upsert_ingestion_status(conn, city_id, "synthetic trips", "SUCCESS", details)
            except Exception as e:
                conn.rollback() # Safely discard any failed batch insertions
                upsert_ingestion_status(conn, city_id, "synthetic trips", "FAILED_MONTH", details)
                print(f"❌ Failed to process month {month_str}: {e}")
            
            all_route_rows.clear()
        else:
             print(f"  ⚠️  No flows to create trips for {month}.")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Generate synthetic trips for station-only cities")
    parser.add_argument("--city", help="City name (optional – runs all eligible cities)")
    parser.add_argument("--calibration-city", default="Madrid",
                        help="City with real trip data used for histogram calibration (default: Madrid)")
    args = parser.parse_args()

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

    # Find calibration city
    calib_city = next((c for c in cities if c[1].lower() == args.calibration_city.lower()), None)
    if calib_city is None:
        print(f"❌ Calibration city '{args.calibration_city}' not found.")
        conn.close()
        return

    calib_id = calib_city[0]
    hist_edges, hist_probs = build_trip_distance_histogram(conn, calib_id)

    # Filter target cities
    if args.city:
        target = [c for c in cities if c[1].lower() == args.city.lower()]
        if not target:
            print(f"❌ City '{args.city}' not found.")
            conn.close()
            return
    else:
        # Only process cities without real routes
        target = [c for c in cities if not city_has_real_routes(conn, c[0])]

    print(f"\n🔄 Generating synthetic trips for {len(target)} cities (calibrated from {args.calibration_city})…\n")

    for city_row in target:
        city_id, city_name = city_row[0], city_row[1]
        upsert_ingestion_status(conn, city_id, "synthetic trips", "RUNNING")
        try:
            generate_for_city(conn, city_id, city_name, hist_edges, hist_probs)
            upsert_ingestion_status(conn, city_id, "synthetic trips", "SUCCESS")
        except Exception as e:
            upsert_ingestion_status(conn, city_id, "synthetic trips", "FAILED")
            print(f"❌ Error generating trips for {city_name}: {e}")

    print("\n🏁 Finished synthetic trip generation.")
    conn.close()


if __name__ == "__main__":
    main()
