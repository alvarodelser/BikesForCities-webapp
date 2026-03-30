"""
routes.py – CRUD for routes, route_edges, route_nodes tables.
"""
from typing import List, Tuple

from psycopg2.extras import execute_values


def put_routes(conn, routes: List[Tuple]) -> dict:
    """Bulk insert routes. Returns mapping id_trip -> route_id.

    Tuple layout:
        (city_id, id_trip, origin_node, dest_node, strategy, trip_minutes,
         datetime_unlock, id_bike, origin_lat, origin_lon, dest_lat, dest_lon,
         datetime_lock)
    """
    with conn.cursor() as cur:
        result = execute_values(
            cur,
            """
            INSERT INTO routes (
                city_id, id_trip, origin_node, dest_node, strategy,
                trip_minutes, datetime_unlock, id_bike,
                origin_lat, origin_lon, dest_lat, dest_lon,
                datetime_lock, processed
            )
            VALUES %s
            ON CONFLICT (id_trip) DO UPDATE SET id_trip = EXCLUDED.id_trip
            RETURNING id, id_trip
            """,
            [(*r, False) for r in routes],
            fetch=True,
        )
    conn.commit()
    return {id_trip: route_id for route_id, id_trip in result}


def put_route_edges(conn, route_edge_tuples: List[Tuple[int, int]]):
    """Bulk insert (route_id, edge_id) into route_edges."""
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO route_edges (route_id, edge_id) VALUES %s",
            route_edge_tuples,
        )
    conn.commit()


def put_route_edges_with_order(conn, route_edge_tuples: List[Tuple[int, int, int]]):
    """Bulk insert (route_id, edge_id, edge_order) into route_edges."""
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO route_edges (route_id, edge_id, edge_order) VALUES %s",
            route_edge_tuples,
        )
    conn.commit()


def get_routes_without_edges(conn, city_id: int, limit: int = 1000) -> List[Tuple]:
    """Return routes with no entries in route_edges (useful for repair)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT r.id, r.id_trip, r.origin_node, r.dest_node, r.strategy
            FROM routes r
            LEFT JOIN route_edges re ON r.id = re.route_id
            WHERE r.city_id = %s AND re.id IS NULL
            LIMIT %s
            """,
            (city_id, limit),
        )
        return cur.fetchall()


def get_unprocessed_route_groups(conn, city_id: int, limit: int = 1000) -> List[Tuple]:
    """Return unique (origin_node, dest_node, strategy) groups for unprocessed routes,
    ordered by count descending.
    Returns: (origin_node, dest_node, strategy, count, route_ids[])
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT origin_node, dest_node, strategy, COUNT(*), ARRAY_AGG(id)
            FROM routes
            WHERE city_id = %s AND processed = FALSE
              AND origin_node IS NOT NULL AND dest_node IS NOT NULL
            GROUP BY origin_node, dest_node, strategy
            ORDER BY COUNT(*) DESC
            LIMIT %s
            """,
            (city_id, limit),
        )
        return cur.fetchall()


def mark_routes_processed(conn, route_ids: List[int]):
    """Mark a list of routes as processed."""
    with conn.cursor() as cur:
        execute_values(
            cur,
            "UPDATE routes SET processed = TRUE WHERE id = ANY(%s)",
            ([route_ids],),
        )
    conn.commit()


def count_routes(conn, city_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM routes WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]
