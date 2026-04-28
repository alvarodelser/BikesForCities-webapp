"""
edge_routes.py – queries for routes passing through a specific edge.
"""
from typing import List, Dict, Any, Optional, Tuple


def _filter_clauses(
    generation_type: Optional[str],
    algorithm: Optional[str],
    month: Optional[str],
) -> Tuple[str, str, Dict[str, Any]]:
    """Build optional WHERE fragments for trip/path/month filters.

    Returns (trip_clause, path_clause, params). Each clause is appended to
    the appropriate JOIN's WHERE; empty when the filter is unset.
    """
    params: Dict[str, Any] = {}
    trip_parts: List[str] = []
    path_parts: List[str] = []
    if generation_type:
        trip_parts.append("t.generation_type = %(generation_type)s")
        params["generation_type"] = generation_type
    if algorithm:
        path_parts.append("p.algorithm = %(algorithm)s")
        params["algorithm"] = algorithm
    if month:
        trip_parts.append("to_char(t.datetime_unlock, 'YYYY-MM') = %(month)s")
        params["month"] = month
    trip_clause = (" AND " + " AND ".join(trip_parts)) if trip_parts else ""
    path_clause = (" AND " + " AND ".join(path_parts)) if path_parts else ""
    return trip_clause, path_clause, params


def count_edge_routes(
    conn,
    city_id: int,
    edge_id: int,
    generation_type: Optional[str] = None,
    algorithm: Optional[str] = None,
    month: Optional[str] = None,
) -> int:
    """Return the total number of distinct path_ids passing through edge_id
    that match the optional generation/algorithm/month filters."""
    trip_clause, path_clause, params = _filter_clauses(generation_type, algorithm, month)
    params.update({"city_id": city_id, "edge_id": edge_id})
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*) FROM (
                SELECT DISTINCT r.path_id
                FROM routes r
                JOIN trips t ON t.id = r.trip_id
                JOIN paths p ON p.id = r.path_id
                WHERE r.city_id = %(city_id)s
                  AND r.path_id IN (
                    SELECT DISTINCT pe2.path_id
                    FROM path_edges pe2
                    JOIN edges e2 ON e2.id = pe2.edge_id
                    WHERE pe2.edge_id = %(edge_id)s
                      AND e2.city_id  = %(city_id)s
                  )
                  {trip_clause}
                  {path_clause}
            ) sub
            """,
            params,
        )
        return int(cur.fetchone()[0] or 0)


def get_edge_route_traces(
    conn,
    city_id: int,
    edge_id: int,
    limit: int = 500,
    offset: int = 0,
    generation_type: Optional[str] = None,
    algorithm: Optional[str] = None,
    month: Optional[str] = None,
) -> List[str]:
    """Return GeoJSON geometry strings (LineString or MultiLineString) for
    paths in city_id that pass through edge_id, paginated by limit/offset
    and optionally filtered by trip generation/algorithm/month.
    """
    trip_clause, path_clause, params = _filter_clauses(generation_type, algorithm, month)
    params.update({
        "city_id": city_id,
        "edge_id": edge_id,
        "limit": limit,
        "offset": offset,
    })
    with conn.cursor() as cur:
        cur.execute(
            f"""
            WITH matching AS (
                SELECT DISTINCT r.path_id
                FROM routes r
                JOIN trips t ON t.id = r.trip_id
                JOIN paths p ON p.id = r.path_id
                WHERE r.city_id = %(city_id)s
                  AND r.path_id IN (
                    SELECT DISTINCT pe2.path_id
                    FROM path_edges pe2
                    JOIN edges e2 ON e2.id = pe2.edge_id
                    WHERE pe2.edge_id = %(edge_id)s
                      AND e2.city_id  = %(city_id)s
                  )
                  {trip_clause}
                  {path_clause}
                ORDER BY r.path_id
                LIMIT %(limit)s OFFSET %(offset)s
            )
            SELECT ST_AsGeoJSON(ST_LineMerge(ST_Collect(e.geom))) AS geom
            FROM matching m
            JOIN path_edges pe ON pe.path_id = m.path_id
            JOIN edges e       ON e.id = pe.edge_id AND e.city_id = %(city_id)s
            GROUP BY m.path_id
            """,
            params,
        )
        return [row[0] for row in cur.fetchall() if row[0] is not None]


def get_edge_route_od(
    conn,
    city_id: int,
    edge_id: int,
    limit: int = 500,
    offset: int = 0,
    generation_type: Optional[str] = None,
    algorithm: Optional[str] = None,
    month: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return origin and destination lat/lon for each trip passing through
    edge_id in city_id, paginated and optionally filtered.
    """
    trip_clause, path_clause, params = _filter_clauses(generation_type, algorithm, month)
    params.update({
        "city_id": city_id,
        "edge_id": edge_id,
        "limit": limit,
        "offset": offset,
    })
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT
                n_o.lon AS origin_lon, n_o.lat AS origin_lat,
                n_d.lon AS dest_lon,   n_d.lat AS dest_lat
            FROM trips   t
            JOIN routes  r  ON r.trip_id = t.id
            JOIN paths   p  ON p.id = r.path_id
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
              {trip_clause}
              {path_clause}
            ORDER BY t.id
            LIMIT %(limit)s OFFSET %(offset)s
            """,
            params,
        )
        cols = ("origin_lon", "origin_lat", "dest_lon", "dest_lat")
        return [dict(zip(cols, row)) for row in cur.fetchall()]
