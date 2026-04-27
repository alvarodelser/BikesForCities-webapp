"""
traffic.py – CRUD for edge_traffic (trip counts per edge per month per combination).

Each row is keyed by (edge_id, month, generation_type, algorithm):
  generation_type: 'real' | 'station_based' | 'buildings_population'
  algorithm:       'map_matched' | 'safest' | 'shortest' | 'grouped'
"""
from datetime import date
from typing import List, Optional, Tuple

from psycopg2.extras import execute_values


# Priority order: lower index = higher priority
GENERATION_PRIORITY = ['real', 'station_based', 'buildings_population']
ALGORITHM_PRIORITY  = ['map_matched', 'safest', 'shortest', 'grouped']


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def upsert_edge_traffic(conn, records: List[Tuple]):
    """Bulk upsert edge_traffic rows.

    Tuple: (edge_id, city_id, trip_count, month, generation_type, algorithm)
    """
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO edge_traffic
                (edge_id, city_id, trip_count, month, generation_type, algorithm)
            VALUES %s
            ON CONFLICT (edge_id, month, generation_type, algorithm)
            DO UPDATE SET trip_count = EXCLUDED.trip_count
            """,
            records,
        )


def upsert_edge_traffic_for_city(
    conn,
    city_id: int,
    city_name: str,
    generation_type: str,
    algorithm: str,
    month_filter: Optional[date] = None,
):
    """Aggregate path_edges → edge_traffic for one (generation_type, algorithm) slice.

    Counts distinct trips per edge per month. Deletes then replaces the affected
    slice before inserting so re-running is always idempotent.
    """
    print(f"🔄 Calculating traffic for {city_name} "
          f"[{generation_type}/{algorithm}] (city_id={city_id})...")

    with conn.cursor() as cur:
        if month_filter:
            cur.execute(
                """
                DELETE FROM edge_traffic
                WHERE city_id = %s
                  AND generation_type = %s
                  AND algorithm = %s
                  AND month = %s
                """,
                (city_id, generation_type, algorithm, month_filter),
            )
        else:
            cur.execute(
                """
                DELETE FROM edge_traffic
                WHERE city_id = %s
                  AND generation_type = %s
                  AND algorithm = %s
                """,
                (city_id, generation_type, algorithm),
            )

        month_clause = ""
        params: list = [city_id, city_id, generation_type, algorithm]
        if month_filter:
            month_clause = "AND DATE_TRUNC('month', t.datetime_unlock) = %s"
            params.append(month_filter)

        cur.execute(
            f"""
            INSERT INTO edge_traffic
                (edge_id, city_id, trip_count, month, generation_type, algorithm)
            SELECT
                pe.edge_id,
                e.city_id,
                COUNT(r.trip_id)                             AS trip_count,
                DATE_TRUNC('month', t.datetime_unlock)::DATE AS month,
                t.generation_type,
                p.algorithm
            FROM routes     r
            JOIN paths      p  ON p.id        = r.path_id
            JOIN path_edges pe ON pe.path_id  = p.id
            JOIN trips      t  ON t.id        = r.trip_id
            JOIN edges      e  ON e.id        = pe.edge_id
            WHERE e.city_id        = %s
              AND t.city_id        = %s
              AND t.generation_type = %s
              AND p.algorithm       = %s
              AND t.datetime_unlock IS NOT NULL
              {month_clause}
            GROUP BY
                pe.edge_id, e.city_id,
                DATE_TRUNC('month', t.datetime_unlock),
                t.generation_type, p.algorithm
            ON CONFLICT (edge_id, month, generation_type, algorithm)
            DO UPDATE SET trip_count = EXCLUDED.trip_count
            """,
            params,
        )
        rows = cur.rowcount
        print(f"   ✅ Upserted {rows} edge-traffic records.")

        # Update city_modes.traffic: True if any combination has enough distinct edges
        from .cities import TRAFFIC_MIN_EDGES
        cur.execute(
            """
            INSERT INTO city_modes (city_id, traffic)
            SELECT %(id)s, (COUNT(DISTINCT edge_id) >= %(min)s)
            FROM edge_traffic WHERE city_id = %(id)s
            ON CONFLICT (city_id) DO UPDATE SET traffic = EXCLUDED.traffic
            """,
            {'id': city_id, 'min': TRAFFIC_MIN_EDGES},
        )


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_traffic_modes(conn, city_id: int) -> List[Tuple[str, str, int]]:
    """Return available combinations sorted by priority (best first).

    Returns list of (generation_type, algorithm, edge_count).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT generation_type, algorithm, COUNT(DISTINCT edge_id) AS edge_count
            FROM edge_traffic
            WHERE city_id = %s
            GROUP BY generation_type, algorithm
            ORDER BY
                CASE generation_type
                    WHEN 'real'                 THEN 1
                    WHEN 'station_based'        THEN 2
                    WHEN 'buildings_population' THEN 3
                    ELSE 4
                END,
                CASE algorithm
                    WHEN 'map_matched' THEN 1
                    WHEN 'safest'      THEN 2
                    WHEN 'shortest'    THEN 3
                    WHEN 'grouped'     THEN 4
                    ELSE 5
                END
            """,
            (city_id,),
        )
        return cur.fetchall()


def get_best_traffic_mode(conn, city_id: int) -> Optional[Tuple[str, str]]:
    """Return the highest-priority available (generation_type, algorithm) pair."""
    modes = get_traffic_modes(conn, city_id)
    return (modes[0][0], modes[0][1]) if modes else None


def get_latest_traffic_month(
    conn,
    city_id: int,
    generation_type: Optional[str] = None,
    algorithm: Optional[str] = None,
) -> Optional[date]:
    """Return the most recent month for the given combination (or any combination)."""
    with conn.cursor() as cur:
        if generation_type and algorithm:
            cur.execute(
                """
                SELECT MAX(month) FROM edge_traffic
                WHERE city_id = %s
                  AND generation_type = %s
                  AND algorithm = %s
                """,
                (city_id, generation_type, algorithm),
            )
        else:
            cur.execute(
                "SELECT MAX(month) FROM edge_traffic WHERE city_id = %s",
                (city_id,),
            )
        row = cur.fetchone()
        return row[0] if row else None


def get_edge_traffic(
    conn,
    city_id: int,
    generation_type: Optional[str] = None,
    algorithm: Optional[str] = None,
    month: Optional[date] = None,
) -> Tuple[List[Tuple[int, int, date]], str, str, Optional[date]]:
    """Return traffic records plus the resolved (generation_type, algorithm, month).

    If generation_type/algorithm are None, resolves to the best available combination.
    If month is None, resolves to the latest month for that combination.

    Returns: (rows, generation_type, algorithm, month)
    Each row: (edge_id, trip_count, month)
    """
    if generation_type is None or algorithm is None:
        best = get_best_traffic_mode(conn, city_id)
        if best is None:
            return [], None, None, None
        generation_type, algorithm = best

    if month is None:
        month = get_latest_traffic_month(conn, city_id, generation_type, algorithm)
    if month is None:
        return [], generation_type, algorithm, None

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT edge_id, trip_count, month
            FROM edge_traffic
            WHERE city_id        = %s
              AND generation_type = %s
              AND algorithm       = %s
              AND month           = %s
            ORDER BY edge_id
            """,
            (city_id, generation_type, algorithm, month),
        )
        return cur.fetchall(), generation_type, algorithm, month


def get_traffic_stats(
    conn,
    city_id: int,
    generation_type: str,
    algorithm: str,
    month: date,
) -> Optional[dict]:
    """Return percentile stats for the colormap (q5, q50, q95, min, max)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY trip_count) AS q5,
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY trip_count) AS q50,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY trip_count) AS q95,
                MIN(trip_count) AS min,
                MAX(trip_count) AS max
            FROM edge_traffic
            WHERE city_id        = %s
              AND generation_type = %s
              AND algorithm       = %s
              AND month           = %s
            """,
            (city_id, generation_type, algorithm, month),
        )
        row = cur.fetchone()
        if not row or row[0] is None:
            return None
        return {
            'q5':  float(row[0]),
            'q50': float(row[1]),
            'q95': float(row[2]),
            'min': float(row[3]),
            'max': float(row[4]),
        }


def has_traffic(conn, city_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM edge_traffic WHERE city_id = %s)",
            (city_id,),
        )
        return cur.fetchone()[0]


def get_traffic_infra_coverage(
    conn,
    city_id: int,
    generation_type: str,
    algorithm: str,
    month: date,
) -> dict:
    """Return km of simulated trips that traverse cycling infrastructure.

    Weights each edge's length by its trip_count (trip-weighted km).
    Separate cycleway edges (highway LIKE '%cycleway%') from the rest.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                SUM(e.length * et.trip_count)
                    FILTER (WHERE e.highway LIKE '%%cycleway%%') AS infra_weighted,
                SUM(e.length * et.trip_count)                    AS total_weighted,
                SUM(e.length)
                    FILTER (WHERE e.highway LIKE '%%cycleway%%') AS infra_km_raw
            FROM edge_traffic et
            JOIN edges e ON e.id = et.edge_id
            WHERE et.city_id        = %s
              AND et.generation_type = %s
              AND et.algorithm       = %s
              AND et.month           = %s
            """,
            (city_id, generation_type, algorithm, month),
        )
        row = cur.fetchone()

    if not row or row[1] is None or float(row[1]) == 0:
        return {"infra_fraction": None, "km_on_infra": None}

    infra_weighted = float(row[0] or 0)
    total_weighted = float(row[1])
    infra_km = float(row[2] or 0) / 1000.0

    return {
        "infra_fraction": infra_weighted / total_weighted if total_weighted > 0 else None,
        "km_on_infra": round(infra_km, 2),
    }


def get_route_histogram(conn, city_id: int, bins: int = 20) -> list:
    """Compute route-length and infra-fraction histograms per (generation_type, algorithm).

    Returns a list of series objects ready for charting. Uses numpy for binning
    after fetching per-path stats from path_edges. Capped at 100 k paths.
    """
    import numpy as np
    from collections import defaultdict

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                t.generation_type,
                p.algorithm,
                SUM(e.length) / 1000.0 AS length_km,
                SUM(CASE WHEN e.highway LIKE '%%cycleway%%' THEN e.length ELSE 0 END)
                    / NULLIF(SUM(e.length), 0) AS infra_fraction
            FROM paths p
            JOIN path_edges pe ON pe.path_id  = p.id
            JOIN edges      e  ON e.id        = pe.edge_id
            JOIN routes     r  ON r.path_id   = p.id
            JOIN trips      t  ON t.id        = r.trip_id
            WHERE p.city_id = %s
              AND t.city_id = %s
            GROUP BY p.id, t.generation_type, p.algorithm
            LIMIT 100000
            """,
            (city_id, city_id),
        )
        rows = cur.fetchall()

    if not rows:
        return []

    groups: dict = defaultdict(lambda: {"lengths": [], "infra": []})
    for gen_type, algo, length_km, infra_frac in rows:
        key = (gen_type or "unknown", algo or "unknown")
        if length_km is not None:
            groups[key]["lengths"].append(float(length_km))
        if infra_frac is not None:
            groups[key]["infra"].append(float(infra_frac))

    all_lengths = [v for g in groups.values() for v in g["lengths"]]
    if not all_lengths:
        return []

    p1, p99 = float(np.percentile(all_lengths, 1)), float(np.percentile(all_lengths, 99))
    len_edges  = np.linspace(p1, p99, bins + 1).tolist()
    infra_edges = np.linspace(0.0, 1.0, bins + 1).tolist()

    result = []
    for (gen_type, algo), data in sorted(groups.items()):
        clipped = [l for l in data["lengths"] if p1 <= l <= p99]
        lc, _ = np.histogram(clipped, bins=len_edges)
        ic, _ = np.histogram(data["infra"], bins=infra_edges)
        result.append({
            "generation_type": gen_type,
            "algorithm": algo,
            "n_routes": len(data["lengths"]),
            "length_km": {
                "bin_edges": [round(b, 3) for b in len_edges],
                "counts": lc.tolist(),
            },
            "infra_fraction": {
                "bin_edges": [round(b, 4) for b in infra_edges],
                "counts": ic.tolist(),
            },
        })
    return result
