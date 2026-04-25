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
            LEFT JOIN routes r  ON r.trip_id = t.id
            LEFT JOIN paths  p  ON p.id = r.path_id AND p.algorithm = 'shortest'
            WHERE t.city_id = %s AND p.id IS NULL
              AND t.origin_node IS NOT NULL AND t.dest_node IS NOT NULL
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
            LEFT JOIN routes r ON r.trip_id = t.id
            LEFT JOIN paths  p ON p.id = r.path_id AND p.algorithm = 'shortest'
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
