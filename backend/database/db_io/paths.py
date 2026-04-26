"""
paths.py – CRUD for the paths, path_edges, and path_nodes tables.
"""
from typing import List, Tuple, Optional

from psycopg2.extras import execute_values


def get_or_create_shortest_path(conn, city_id: int, origin_node: int, dest_node: int) -> int:
    """Upsert a shortest-path record and return its id.

    Uses the partial unique index (city_id, origin_node, dest_node WHERE algorithm='shortest')
    to deduplicate: only one canonical shortest path exists per O-D pair per city.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO paths (city_id, origin_node, dest_node, algorithm)
            VALUES (%s, %s, %s, 'shortest')
            ON CONFLICT (city_id, origin_node, dest_node) WHERE algorithm = 'shortest'
            DO UPDATE SET city_id = EXCLUDED.city_id
            RETURNING id
            """,
            (city_id, origin_node, dest_node),
        )
        return cur.fetchone()[0]


def put_map_matched_path(conn, city_id: int, origin_node: int, dest_node: int) -> int:
    """Insert a new map-matched path (no deduplication) and return its id.

    Each GPS-tracked trip produces a unique path even if the O-D nodes are the same.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO paths (city_id, origin_node, dest_node, algorithm)
            VALUES (%s, %s, %s, 'map_matched')
            RETURNING id
            """,
            (city_id, origin_node, dest_node),
        )
        return cur.fetchone()[0]


def put_path_edges(conn, path_id: int, edge_tuples: List[Tuple[int, int]]):
    """Bulk-insert ordered edges for a path.

    edge_tuples: [(edge_id, edge_order), ...]
    """
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO path_edges (path_id, edge_id, edge_order) VALUES %s ON CONFLICT DO NOTHING",
            [(path_id, edge_id, order) for edge_id, order in edge_tuples],
        )


def put_path_nodes(conn, path_id: int, node_sequence: List[int]):
    """Bulk-insert the ordered node sequence for a path.

    node_sequence: list of node IDs in traversal order.
    """
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO path_nodes (path_id, node_id, node_order) VALUES %s ON CONFLICT DO NOTHING",
            [(path_id, node_id, i) for i, node_id in enumerate(node_sequence)],
        )


def link_trip_to_path(
    conn, trip_id: int, path_id: int, city_id: int, processed: bool = True
):
    """Create (or update) the routes join-table row linking a trip to its computed path."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO routes (city_id, trip_id, path_id, processed)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (trip_id, path_id) DO UPDATE SET processed = EXCLUDED.processed
            """,
            (city_id, trip_id, path_id, processed),
        )


def bulk_link_trips_to_path(conn, city_id: int, trip_ids: List[int], path_id: int):
    """Link multiple trips to the same path (typical for shortest-path batches)."""
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO routes (city_id, trip_id, path_id, processed)
            VALUES %s
            ON CONFLICT (trip_id, path_id) DO UPDATE SET processed = TRUE
            """,
            [(city_id, trip_id, path_id, True) for trip_id in trip_ids],
        )
