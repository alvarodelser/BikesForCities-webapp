"""
routes.py – thin wrappers around the routes join table.

The routes table links trips to their computed paths. Most business logic
now lives in trips.py (demand records) and paths.py (path computation).
"""
from typing import List

from .trips import count_trips, get_unrouted_trip_groups


# ---------------------------------------------------------------------------
# Backward-compatible alias used by scripts/visualization/API layer
# ---------------------------------------------------------------------------

def count_routes(conn, city_id: int) -> int:
    """Alias for count_trips – returns number of demand records for a city."""
    return count_trips(conn, city_id)


# ---------------------------------------------------------------------------
# Routes join-table helpers
# ---------------------------------------------------------------------------

def get_trips_without_path(conn, city_id: int, limit: int = 1000) -> List[tuple]:
    """Return trips that have no path assigned (path_id IS NULL in routes)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.id, t.id_trip, t.origin_node, t.dest_node, t.generation_type
            FROM trips t
            LEFT JOIN routes r ON r.trip_id = t.id AND r.path_id IS NOT NULL
            WHERE t.city_id = %s AND r.id IS NULL
              AND t.origin_node IS NOT NULL AND t.dest_node IS NOT NULL
            LIMIT %s
            """,
            (city_id, limit),
        )
        return cur.fetchall()
