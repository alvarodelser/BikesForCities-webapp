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
    all paths in city_id that pass through edge_id, up to limit paths.

    Uses ST_LineMerge(ST_Collect(geom)) to merge ordered edge segments into a
    single LineString per path where the edges are topologically connected.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ST_AsGeoJSON(ST_LineMerge(ST_Collect(geom))) AS geom
            FROM (
                SELECT pe.path_id, e.geom
                FROM path_edges pe
                JOIN edges e ON e.id = pe.edge_id
                WHERE pe.path_id IN (
                    SELECT DISTINCT pe2.path_id
                    FROM path_edges pe2
                    JOIN edges e2 ON e2.id = pe2.edge_id
                    WHERE pe2.edge_id = %(edge_id)s
                      AND e2.city_id  = %(city_id)s
                )
                AND e.city_id = %(city_id)s
                ORDER BY pe.path_id, pe.edge_order
            ) sub
            GROUP BY path_id
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
    """Return origin and destination lat/lon for each trip passing through
    edge_id in city_id, up to limit trips.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                n_o.lon AS origin_lon, n_o.lat AS origin_lat,
                n_d.lon AS dest_lon,   n_d.lat AS dest_lat
            FROM trips   t
            JOIN routes  r  ON r.trip_id = t.id
            JOIN nodes   n_o ON n_o.id = t.origin_node
            JOIN nodes   n_d ON n_d.id = t.dest_node
            WHERE t.city_id = %(city_id)s
              AND r.path_id IN (
                SELECT DISTINCT pe2.path_id
                FROM path_edges pe2
                JOIN edges e2 ON e2.id = pe2.edge_id
                WHERE pe2.edge_id = %(edge_id)s
                  AND e2.city_id  = %(city_id)s
              )
            LIMIT %(limit)s
            """,
            {"city_id": city_id, "edge_id": edge_id, "limit": limit},
        )
        cols = ("origin_lon", "origin_lat", "dest_lon", "dest_lat")
        return [dict(zip(cols, row)) for row in cur.fetchall()]
