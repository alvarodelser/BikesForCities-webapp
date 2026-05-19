"""
trips.py – CRUD for the trips table (demand records: real and synthetic O-D pairs).
"""
from typing import List, Tuple, Optional

from psycopg2.extras import execute_values, RealDictCursor


def put_trips(conn, trips: List[Tuple]) -> dict:
    """Bulk-insert trips. Returns mapping id_trip -> trip_id.

    Tuple layout:
        (city_id, id_trip, origin_node, dest_node, trip_minutes,
         datetime_unlock, id_bike, datetime_lock, generation_type)
    """
    with conn.cursor() as cur:
        result = execute_values(
            cur,
            """
            INSERT INTO trips (
                city_id, id_trip, origin_node, dest_node, trip_minutes,
                datetime_unlock, id_bike, datetime_lock, generation_type
            )
            VALUES %s
            ON CONFLICT (id_trip) DO NOTHING
            RETURNING id, id_trip
            """,
            trips,
            fetch=True,
        )
    return {id_trip: trip_id for trip_id, id_trip in result}


def count_trips(conn, city_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM trips WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]


def count_unrouted_trips(conn, city_id: int) -> int:
    """Trips that have no routes row pointing to a shortest-path path."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM trips t
            WHERE t.city_id = %s
              AND t.origin_node IS NOT NULL AND t.dest_node IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM routes r
                JOIN paths p ON p.id = r.path_id AND p.algorithm = 'shortest'
                WHERE r.trip_id = t.id
              )
            """,
            (city_id,),
        )
        return cur.fetchone()[0]


def get_unrouted_trip_groups(conn, city_id: int, limit: int = 1000) -> List[Tuple]:
    """Return unique (origin_node, dest_node) groups for trips not yet shortest-path routed.

    Returns: (origin_node, dest_node, count, trip_ids[])
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.origin_node, t.dest_node, COUNT(*), ARRAY_AGG(t.id)
            FROM trips t
            WHERE t.city_id = %s
              AND t.origin_node IS NOT NULL AND t.dest_node IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM routes r
                JOIN paths p ON p.id = r.path_id AND p.algorithm = 'shortest'
                WHERE r.trip_id = t.id
              )
            GROUP BY t.origin_node, t.dest_node
            ORDER BY COUNT(*) DESC
            LIMIT %s
            """,
            (city_id, limit),
        )
        return cur.fetchall()


def count_unsaferouted_trips(conn, city_id: int) -> int:
    """Trips that have no routes row pointing to a safest-path path."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM trips t
            LEFT JOIN routes r  ON r.trip_id = t.id
            LEFT JOIN paths  p  ON p.id = r.path_id AND p.algorithm = 'safest'
            WHERE t.city_id = %s AND p.id IS NULL
              AND t.origin_node IS NOT NULL AND t.dest_node IS NOT NULL
            """,
            (city_id,),
        )
        return cur.fetchone()[0]


def get_unsaferouted_trip_groups(conn, city_id: int, limit: int = 1000) -> list:
    """Return unique (origin_node, dest_node) groups for trips not yet safest-path routed.

    Returns: (origin_node, dest_node, count, trip_ids[])
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.origin_node, t.dest_node, COUNT(*), ARRAY_AGG(t.id)
            FROM trips t
            LEFT JOIN routes r ON r.trip_id = t.id
            LEFT JOIN paths  p ON p.id = r.path_id AND p.algorithm = 'safest'
            WHERE t.city_id = %s AND p.id IS NULL
              AND t.origin_node IS NOT NULL AND t.dest_node IS NOT NULL
            GROUP BY t.origin_node, t.dest_node
            ORDER BY COUNT(*) DESC
            LIMIT %s
            """,
            (city_id, limit),
        )
        return cur.fetchall()


def city_has_real_trips(conn, city_id: int) -> bool:
    """Return True if the city already has real (non-synthetic) trips."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM trips WHERE city_id = %s AND generation_type = 'real' LIMIT 1",
            (city_id,),
        )
        return cur.fetchone() is not None


def get_paginated_trips(
    conn,
    city_id: int,
    generation_type: Optional[str] = None,
    min_duration: Optional[float] = None,
    max_duration: Optional[float] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[list, int]:
    """Retrieve paginated trips for API with optional filters."""
    conditions = ["city_id = %s"]
    params: list = [city_id]

    if generation_type:
        conditions.append("generation_type = %s")
        params.append(generation_type)
    if min_duration is not None:
        conditions.append("trip_minutes >= %s")
        params.append(min_duration)
    if max_duration is not None:
        conditions.append("trip_minutes <= %s")
        params.append(max_duration)

    where_clause = " AND ".join(conditions)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT COUNT(*) FROM trips WHERE {where_clause}", params)
        total = cur.fetchone()["count"]

        cur.execute(
            f"""
            SELECT id, id_trip, origin_node, dest_node, generation_type,
                   trip_minutes, datetime_unlock, id_bike, created_at
            FROM trips
            WHERE {where_clause}
            ORDER BY id
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset],
        )
        return cur.fetchall(), total


def get_od_hex_flows(
    conn,
    city_id: int,
    generation_type: str,
    period: str | None = None,
    resolution: int = 8,
    min_trips: int | None = None,
) -> dict:
    """Return a GeoJSON FeatureCollection of O-D flows aggregated by H3 hex at the given resolution.

    Each feature is a LineString from origin hex center to destination hex center,
    with a 'count' property (number of trips) and 'weight' (normalised 0-1).
    Same-hex trips are excluded.
    """
    import h3
    from collections import defaultdict

    period_date = (period + '-01') if period else None

    # Aggregate trips by (origin_node, dest_node) first — far cheaper than
    # joining all rows to nodes before grouping on a large table.
    # Cap at 200k most-common pairs so the response stays manageable.
    with conn.cursor() as cur:
        cur.execute("""
            WITH od_counts AS (
                SELECT origin_node, dest_node, COUNT(*) AS cnt
                FROM trips
                WHERE city_id = %s AND generation_type = %s
                  AND origin_node IS NOT NULL AND dest_node IS NOT NULL
                  AND (%s IS NULL OR DATE_TRUNC('month', datetime_unlock) = %s::date)
                GROUP BY origin_node, dest_node
                ORDER BY cnt DESC
                LIMIT 200000
            )
            SELECT n1.lat, n1.lon, n2.lat, n2.lon, od.cnt
            FROM od_counts od
            JOIN nodes n1 ON n1.id = od.origin_node
            JOIN nodes n2 ON n2.id = od.dest_node
            WHERE n1.lat IS NOT NULL AND n1.lon IS NOT NULL
              AND n2.lat IS NOT NULL AND n2.lon IS NOT NULL
        """, (city_id, generation_type, period_date, period_date))
        node_pairs = cur.fetchall()

    hex_counts: dict = defaultdict(int)
    hex_centers: dict = {}

    for orig_lat, orig_lon, dest_lat, dest_lon, cnt in node_pairs:
        if None in (orig_lat, orig_lon, dest_lat, dest_lon):
            continue
        oh = h3.latlng_to_cell(float(orig_lat), float(orig_lon), resolution)
        dh = h3.latlng_to_cell(float(dest_lat), float(dest_lon), resolution)
        if oh == dh:
            continue
        hex_counts[(oh, dh)] += int(cnt)
        for hx in (oh, dh):
            if hx not in hex_centers:
                lat, lon = h3.cell_to_latlng(hx)
                hex_centers[hx] = (lat, lon)

    if not hex_counts:
        return {"type": "FeatureCollection", "features": []}

    if min_trips is None:
        total = sum(hex_counts.values())
        num_origins = len({oh for oh, _ in hex_counts})
        min_trips = max(1, total // (num_origins * 5))

    max_count = max(hex_counts.values())
    features = []
    for (oh, dh), count in hex_counts.items():
        if count < min_trips:
            continue
        olat, olon = hex_centers[oh]
        dlat, dlon = hex_centers[dh]
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[olon, olat], [dlon, dlat]]},
            "properties": {
                "count": count,
                "weight": count / max_count,
                "orig_hex": oh,
                "dest_hex": dh,
            },
        })

    features.sort(key=lambda f: f["properties"]["count"])  # draw heavy flows on top
    return {"type": "FeatureCollection", "features": features}


def get_trip_stats(conn, city_id: int) -> Optional[dict]:
    """Get statistical aggregations for city trips."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
                AVG(trip_minutes)  AS avg_duration,
                MIN(trip_minutes)  AS min_duration,
                MAX(trip_minutes)  AS max_duration,
                COUNT(DISTINCT id_bike) AS unique_bikes
            FROM trips
            WHERE city_id = %s
            """,
            (city_id,),
        )
        return cur.fetchone()
