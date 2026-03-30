"""
graph.py – CRUD for spatial graph tables: nodes and edges.
"""
from typing import List, Tuple

import psycopg2


def put_nodes(conn, nodes: List[Tuple]):
    """Bulk-insert node rows.

    Tuple layout: (city_id, id, osmid, lat, lon, geom_wkt, street_count)
    """
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO nodes (city_id, id, osmid, lat, lon, geom, street_count)
            VALUES (%s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326), %s)
            ON CONFLICT (id) DO NOTHING
            """,
            nodes,
        )
    conn.commit()


def put_edges(conn, edges: List[Tuple]):
    """Bulk-insert edge rows.

    Tuple layout: (city_id, osmid, u, v, k, geom, highway, name, length, width,
                   maxspeed, lanes, oneway, tunnel, bridge)
    """
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO edges (
                city_id, osmid, u, v, k, geom, highway, name, length, width,
                maxspeed, lanes, oneway, tunnel, bridge
            )
            VALUES (
                %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326),
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (u, v, k) DO NOTHING
            """,
            [
                (e[0], e[1], e[2], e[3], e[4], e[5].wkt, *e[6:])
                for e in edges
            ],
        )
    conn.commit()


def get_nodes(conn, city_id: int) -> List[Tuple]:
    """Retrieve all nodes for a city. Returns (id, lat, lon, geom_wkt, street_count)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, lat, lon, ST_AsText(geom), street_count FROM nodes WHERE city_id = %s",
            (city_id,),
        )
        return cur.fetchall()


def get_edges(conn, city_id: int) -> List[Tuple]:
    """Retrieve all edges for a city."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT osmid, u, v, k, ST_AsText(geom),
                   highway, name, length, width,
                   maxspeed, lanes, oneway, tunnel, bridge
            FROM edges
            WHERE city_id = %s
            """,
            (city_id,),
        )
        return cur.fetchall()


def get_edge_id_map(conn, city_id: int) -> dict:
    """Return a mapping of (u, v) -> edge_id for a given city (picks minimum id per pair)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT u, v, MIN(id) FROM edges WHERE city_id = %s GROUP BY u, v",
            (city_id,),
        )
        return {(u, v): edge_id for u, v, edge_id in cur.fetchall()}


def count_nodes(conn, city_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM nodes WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]


def count_edges(conn, city_id: int) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM edges WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]
