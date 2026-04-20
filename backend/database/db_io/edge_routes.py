"""
edge_routes.py – queries for routes passing through a specific edge.
"""
from typing import List, Dict, Any


def get_edge_route_traces(
    conn,
    city_id: int,
    edge_id: int,
    limit: int = 500,
) -> List[str]:
    """Return GeoJSON geometry strings (LineString or MultiLineString) for
    all routes in city_id that pass through edge_id, up to limit routes.

    Uses ST_LineMerge(ST_Collect(geom)) to merge ordered edge segments into a
    single LineString per route where the edges are topologically connected.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ST_AsGeoJSON(ST_LineMerge(ST_Collect(geom))) AS geom
            FROM (
                SELECT re.route_id, e.geom
                FROM route_edges re
                JOIN edges e ON e.id = re.edge_id
                JOIN routes r ON r.id = re.route_id
                WHERE re.route_id IN (
                    SELECT DISTINCT re2.route_id
                    FROM route_edges re2
                    JOIN edges e2 ON e2.id = re2.edge_id
                    WHERE re2.edge_id = %(edge_id)s
                      AND e2.city_id = %(city_id)s
                )
                AND r.city_id = %(city_id)s
                ORDER BY re.route_id, re.edge_order
            ) sub
            GROUP BY route_id
            LIMIT %(limit)s
            """,
            {"edge_id": edge_id, "city_id": city_id, "limit": limit},
        )
        return [row[0] for row in cur.fetchall() if row[0] is not None]


def get_edge_route_od(
    conn,
    city_id: int,
    edge_id: int,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    """Return origin and destination lat/lon for each route passing through
    edge_id in city_id, up to limit routes.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                n_o.lon AS origin_lon, n_o.lat AS origin_lat,
                n_d.lon AS dest_lon,   n_d.lat AS dest_lat
            FROM routes r
            JOIN nodes n_o ON n_o.id = r.origin_node
            JOIN nodes n_d ON n_d.id = r.dest_node
            WHERE r.city_id = %(city_id)s
              AND r.id IN (
                SELECT DISTINCT re2.route_id
                FROM route_edges re2
                JOIN edges e2 ON e2.id = re2.edge_id
                WHERE re2.edge_id = %(edge_id)s
                  AND e2.city_id = %(city_id)s
              )
            LIMIT %(limit)s
            """,
            {"city_id": city_id, "edge_id": edge_id, "limit": limit},
        )
        cols = ("origin_lon", "origin_lat", "dest_lon", "dest_lat")
        return [dict(zip(cols, row)) for row in cur.fetchall()]
