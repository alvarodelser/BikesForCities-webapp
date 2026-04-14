"""
graph.py – CRUD for spatial graph tables: nodes and edges.
"""
from typing import List, Tuple, Optional
import psycopg2
from psycopg2.extras import RealDictCursor


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


def get_paginated_nodes(conn, city_id: int, bbox: Optional[Tuple[float, float, float, float]] = None,
                        limit: int = 100, offset: int = 0) -> Tuple[list, int]:
    """Retrieve paginated nodes for API with optional bbox filter."""
    conditions = ["city_id = %s"]
    params = [city_id]
    
    if bbox:
        conditions.append("ST_Intersects(geom, ST_MakeEnvelope(%s, %s, %s, %s, 4326))")
        params.extend(bbox)
        
    where_clause = " AND ".join(conditions)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Count
        cur.execute(f"SELECT COUNT(*) FROM nodes WHERE {where_clause}", params)
        total = cur.fetchone()["count"]
        
        # Paginated fetch
        query = f"""
            SELECT id, lat, lon, street_count
            FROM nodes
            WHERE {where_clause}
            ORDER BY id
            LIMIT %s OFFSET %s
        """
        cur.execute(query, params + [limit, offset])
        return cur.fetchall(), total


def get_paginated_edges(conn, city_id: int, highway: Optional[str] = None, 
                        bbox: Optional[Tuple[float, float, float, float]] = None,
                        limit: int = 100, offset: int = 0) -> Tuple[list, int]:
    """Retrieve paginated edges for API with optional filters."""
    conditions = ["city_id = %s"]
    params = [city_id]
    
    if highway:
        conditions.append("highway = %s")
        params.append(highway)
        
    if bbox:
        conditions.append("ST_Intersects(geom, ST_MakeEnvelope(%s, %s, %s, %s, 4326))")
        params.extend(bbox)
        
    where_clause = " AND ".join(conditions)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Count
        cur.execute(f"SELECT COUNT(*) FROM edges WHERE {where_clause}", params)
        total = cur.fetchone()["count"]
        
        # Paginated fetch
        query = f"""
            SELECT 
                id, osmid, u, v, k, ST_AsText(geom) as geometry,
                highway, name, length, width,
                maxspeed, lanes, oneway, tunnel, bridge
            FROM edges
            WHERE {where_clause}
            ORDER BY id
            LIMIT %s OFFSET %s
        """
        cur.execute(query, params + [limit, offset])
        return cur.fetchall(), total


def get_highway_distribution(conn, city_id: int, limit: int = 15) -> List[Tuple[str, int]]:
    """Get count of edges per highway type for analysis."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT highway, COUNT(*) as count
            FROM edges 
            WHERE city_id = %s 
            GROUP BY highway 
            ORDER BY count DESC
            LIMIT %s
            """,
            (city_id, limit)
        )
        return cur.fetchall()


def get_station_reachability(
    conn, city_id: int, station_lat: float, station_lon: float,
    max_distance: float = 1000.0,
) -> List[dict]:
    """Compute a reachability tree from the closest node to the given lat/lon.

    Uses Dijkstra expansion along edges, respecting one-way constraints.
    Stops when cumulative distance exceeds *max_distance* metres.

    Returns a list of dicts, each with keys:
        geojson_geom  – GeoJSON geometry string for the edge
        dist_start    – cumulative distance at the start node (metres)
        dist_end      – cumulative distance at the end node (metres)
    """
    import heapq
    import json

    with conn.cursor() as cur:
        # 1. Find the closest node
        cur.execute(
            """
            SELECT id, lat, lon
            FROM nodes
            WHERE city_id = %s
            ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            LIMIT 1
            """,
            (city_id, station_lon, station_lat),
        )
        root_row = cur.fetchone()
        if root_row is None:
            return []
        root_id = root_row[0]

        # 2. Fetch all edges for the city
        cur.execute(
            """
            SELECT u, v, length, oneway, ST_AsGeoJSON(geom) as geojson
            FROM edges
            WHERE city_id = %s
            """,
            (city_id,),
        )
        edges_raw = cur.fetchall()

    # 3. Build adjacency list
    # adj[node_id] = [(neighbour_id, edge_length, geojson_geom, is_forward)]
    from collections import defaultdict
    adj: dict = defaultdict(list)
    for u, v, length, oneway, geojson in edges_raw:
        length = float(length) if length else 0.0
        adj[u].append((v, length, geojson, True))
        if not oneway:
            adj[v].append((u, length, geojson, False))

    # 4. Dijkstra expansion
    dist: dict = {root_id: 0.0}
    visited: set = set()
    heap = [(0.0, root_id)]  # (distance, node_id)
    result_edges: List[dict] = []

    while heap:
        d, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)

        for neighbour, edge_len, geojson, is_forward in adj.get(node, []):
            new_dist = d + edge_len
            if new_dist > max_distance:
                # Still include this edge (it crosses the boundary)
                result_edges.append({
                    "geojson_geom": json.loads(geojson),
                    "dist_start": d,
                    "dist_end": new_dist,
                })
                continue
            if neighbour in visited:
                continue
            if neighbour not in dist or new_dist < dist[neighbour]:
                dist[neighbour] = new_dist
                heapq.heappush(heap, (new_dist, neighbour))
                result_edges.append({
                    "geojson_geom": json.loads(geojson),
                    "dist_start": d,
                    "dist_end": new_dist,
                })

    return result_edges
