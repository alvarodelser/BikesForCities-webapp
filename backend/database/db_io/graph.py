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
    if not edges:
        return
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
    from .cities import refresh_city_modes
    refresh_city_modes(conn, edges[0][0])


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

# ---------- Reachability helpers ----------

def _build_adj_list(edges_raw) -> dict:
    """Build an adjacency list from raw edge tuples (u, v, length, oneway, geojson)."""
    from collections import defaultdict
    adj: dict = defaultdict(list)
    for u, v, length, oneway, geojson in edges_raw:
        length = float(length) if length else 0.0
        adj[u].append((v, length, geojson, True))
        if not oneway:
            adj[v].append((u, length, geojson, False))
    return adj


def _run_dijkstra(adj: dict, root_id, max_distance: float):
    """Run Dijkstra from *root_id*, stopping at *max_distance* metres.

    Returns (parent, dist, visited) where:
        parent  – {node_id: (from_node, edge_len, geojson_str, is_forward)}
        dist    – {node_id: shortest_distance}
        visited – set of visited node IDs
    """
    import heapq

    dist = {root_id: 0.0}
    parent: dict = {}
    visited: set = set()
    heap = [(0.0, root_id)]

    while heap:
        d, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)

        for neighbour, edge_len, geojson, is_fwd in adj.get(node, []):
            new_dist = d + edge_len
            if neighbour in visited:
                continue
            if new_dist > max_distance:
                continue
            if neighbour not in dist or new_dist < dist[neighbour]:
                dist[neighbour] = new_dist
                parent[neighbour] = (node, edge_len, geojson, is_fwd)
                heapq.heappush(heap, (new_dist, neighbour))

    return parent, dist, visited


def _collect_reach_edges(adj, parent, dist, visited, max_distance):
    """Build the list of reach-tree edges (including boundary-cropped edges).

    Returns (result_edges, all_coords) where:
        result_edges – list of {geojson_geom, dist_start, dist_end}
        all_coords   – list of (lon, lat) endpoint coordinates for hull construction
    """
    import json
    from shapely.geometry import shape, mapping
    from shapely.ops import substring

    result_edges: list = []
    all_coords: list = []

    # Tree edges (fully within range)
    for node_id, (from_node, edge_len, geojson_str, _is_fwd) in parent.items():
        parsed = json.loads(geojson_str)
        result_edges.append({
            "geojson_geom": parsed,
            "dist_start": dist[from_node],
            "dist_end": dist[node_id],
        })
        coords = parsed.get("coordinates", [])
        if coords:
            all_coords.append(tuple(coords[0][:2]))
            all_coords.append(tuple(coords[-1][:2]))

    # Boundary edges (cropped at max_distance)
    for node in visited:
        d = dist[node]
        for neighbour, edge_len, geojson_str, is_fwd in adj.get(node, []):
            if neighbour in visited:
                continue
            remaining = max_distance - d
            if remaining <= 0 or edge_len <= 0:
                continue
            fraction = min(remaining / edge_len, 1.0)
            try:
                geom = shape(json.loads(geojson_str))
                if is_fwd:
                    cropped = substring(geom, 0, fraction, normalized=True)
                else:
                    cropped = substring(geom, 1 - fraction, 1, normalized=True)
                if not cropped.is_empty:
                    cropped_mapping = mapping(cropped)
                    result_edges.append({
                        "geojson_geom": cropped_mapping,
                        "dist_start": d,
                        "dist_end": max_distance,
                    })
                    crop_coords = list(cropped.coords)
                    if crop_coords:
                        all_coords.append(tuple(crop_coords[-1][:2]))
            except Exception:
                pass

    return result_edges, all_coords


def _polygon_area_m2(polygon, ref_lat: float) -> float:
    """Approximate area of a lon/lat polygon in m² using cos(lat) scaling."""
    import math
    cos_lat = math.cos(math.radians(ref_lat))
    m_per_deg_lon = 111_320 * cos_lat
    m_per_deg_lat = 110_540
    coords = list(polygon.exterior.coords)
    n = len(coords)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += (coords[i][0] * m_per_deg_lon) * (coords[j][1] * m_per_deg_lat)
        area -= (coords[j][0] * m_per_deg_lon) * (coords[i][1] * m_per_deg_lat)
    return abs(area) / 2.0


def _compute_coverage(result_edges, station_lat: float, station_lon: float, max_distance: float) -> Tuple[Optional[dict], float]:
    """Build a polygon by buffering the union of reach-edge geometries.

    This produces a star-shaped polygon that follows the actual road network,
    rather than a convex hull that overshoots into unreachable areas.

    Returns (polygon_geojson_or_None, coverage_pct).
    """
    import math
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union

    if len(result_edges) < 2:
        return None, 0.0

    # Build Shapely geometries from the edge GeoJSON
    geoms = []
    for edge in result_edges:
        try:
            g = shape(edge["geojson_geom"])
            if not g.is_empty:
                geoms.append(g)
        except Exception:
            pass

    if not geoms:
        return None, 0.0

    # Union all edge lines, then buffer to create a corridor polygon
    # ~80 m in degrees at typical European latitudes (0.0008° ≈ 80 m)
    buf_deg = 0.0008
    network = unary_union(geoms)
    polygon = network.buffer(buf_deg, resolution=8)

    # Smooth jagged edges
    polygon = polygon.simplify(0.0002, preserve_topology=True)

    if polygon.is_empty or polygon.geom_type not in ('Polygon', 'MultiPolygon'):
        return None, 0.0

    # If MultiPolygon, take the largest piece
    if polygon.geom_type == 'MultiPolygon':
        polygon = max(polygon.geoms, key=lambda p: p.area)

    polygon_area = _polygon_area_m2(polygon, station_lat)
    circle_area = math.pi * max_distance ** 2
    coverage = (polygon_area / circle_area * 100) if circle_area > 0 else 0.0

    return mapping(polygon), min(coverage, 100.0)


# ---------- Public API ----------

def get_station_reachability(
    conn, city_id: int, station_lat: float, station_lon: float,
    max_distance: float = 1000.0,
) -> dict:
    """Compute a reachability tree from the closest node to the given lat/lon.

    Uses Dijkstra expansion along edges, respecting one-way constraints.
    Edges are cropped exactly at *max_distance* metres.

    Returns a dict with keys:
        edges           – list of {geojson_geom, dist_start, dist_end}
        polygon_geojson – GeoJSON geometry for the convex hull of endpoints
        circle_geojson  – GeoJSON geometry for the geodesic circle at max_distance
        coverage        – polygon_area / circle_area × 100
    """
    import json

    empty_result = {
        "edges": [], "polygon_geojson": None,
        "circle_geojson": None, "coverage": 0.0,
    }

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
            return empty_result
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

        # 3. Compute geodesic circle (geography buffer)
        cur.execute(
            """
            SELECT ST_AsGeoJSON(
                ST_Buffer(ST_MakePoint(%s, %s)::geography, %s)::geometry
            )
            """,
            (station_lon, station_lat, max_distance),
        )
        circle_row = cur.fetchone()
        circle_geojson = json.loads(circle_row[0]) if circle_row else None

    # 4. Build adjacency list + Dijkstra
    adj = _build_adj_list(edges_raw)
    parent, dist, visited = _run_dijkstra(adj, root_id, max_distance)

    # 5. Collect edges + endpoint coordinates
    result_edges, all_coords = _collect_reach_edges(adj, parent, dist, visited, max_distance)

    # 6. Polygon + coverage
    polygon_geojson, coverage = _compute_coverage(result_edges, station_lat, station_lon, max_distance)

    return {
        "edges": result_edges,
        "polygon_geojson": polygon_geojson,
        "circle_geojson": circle_geojson,
        "coverage": round(coverage, 1),
    }


def compute_all_reach_coverages(
    conn, city_id: int, max_distance: float = 1000.0,
) -> dict:
    """Batch-compute reachability coverage for every station in a city.

    Builds the adjacency list once and runs Dijkstra per station.
    Returns {station_id: coverage_pct}.
    """
    with conn.cursor() as cur:
        # 1. Fetch all edges once
        cur.execute(
            """
            SELECT u, v, length, oneway, ST_AsGeoJSON(geom)
            FROM edges WHERE city_id = %s
            """,
            (city_id,),
        )
        edges_raw = cur.fetchall()

        # 2. Fetch all non-merged stations
        cur.execute(
            """
            SELECT station_id, lat, lon
            FROM stations
            WHERE city_id = %s AND merged_into_id IS NULL
            """,
            (city_id,),
        )
        stations = cur.fetchall()

    if not edges_raw or not stations:
        return {}

    adj = _build_adj_list(edges_raw)

    # 3. Build a node-lookup structure for nearest-node queries
    # (in-memory KD-tree avoids per-station PostGIS round-trip)
    import numpy as np
    node_ids_set: set = set()
    for u, v, *_ in edges_raw:
        node_ids_set.add(u)
        node_ids_set.add(v)

    with conn.cursor() as cur:
        if not node_ids_set:
            return {}
        cur.execute(
            "SELECT id, lat, lon FROM nodes WHERE city_id = %s",
            (city_id,),
        )
        node_rows = cur.fetchall()

    if not node_rows:
        return {}

    node_ids_arr = [r[0] for r in node_rows]
    node_coords = np.array([(r[2], r[1]) for r in node_rows])  # (lon, lat)

    from scipy.spatial import cKDTree
    import math

    # Approximate degree-to-metre for the KD-tree (good enough for nearest-node)
    ref_lat = float(stations[0][1])
    cos_lat = math.cos(math.radians(ref_lat))
    scale = np.array([111_320 * cos_lat, 110_540])  # lon, lat → metres
    tree = cKDTree(node_coords * scale)

    results: dict = {}
    for station_id, slat, slon in stations:
        query_pt = np.array([float(slon), float(slat)]) * scale
        _, idx = tree.query(query_pt)
        root_id = node_ids_arr[idx]

        parent, dist, visited = _run_dijkstra(adj, root_id, max_distance)
        result_edges, _ = _collect_reach_edges(adj, parent, dist, visited, max_distance)
        _, coverage = _compute_coverage(result_edges, float(slat), float(slon), max_distance)
        results[station_id] = round(coverage, 1)

    return results



def get_cycling_components_geojson(conn, city_id: int) -> dict:
    """Return cycling edges as GeoJSON FeatureCollection with component_id per edge.

    component_id is ranked by total km (0 = largest/GCC).
    """
    import networkx as nx
    import json

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, u, v, length, ST_AsGeoJSON(geom) AS geojson
            FROM edges
            WHERE city_id = %s AND highway LIKE '%%cycleway%%'
            """,
            (city_id,),
        )
        edge_rows = cur.fetchall()

    if not edge_rows:
        return {"type": "FeatureCollection", "features": []}

    G = nx.Graph()
    for edge_id, u, v, length, _ in edge_rows:
        w = float(length or 0)
        G.add_edge(u, v, weight=w)

    components = list(nx.connected_components(G))

    def _comp_km(nodes):
        return sum(G[u][v]["weight"] for u, v in G.subgraph(nodes).edges()) / 1000.0

    ranked = sorted(components, key=_comp_km, reverse=True)
    node_to_comp = {}
    for comp_id, nodes in enumerate(ranked):
        for node in nodes:
            node_to_comp[node] = comp_id

    features = []
    seen: set = set()
    for edge_id, u, v, _length, geojson_str in edge_rows:
        if edge_id in seen:
            continue
        seen.add(edge_id)
        features.append({
            "type": "Feature",
            "geometry": json.loads(geojson_str),
            "properties": {"edge_id": edge_id, "component_id": node_to_comp.get(u, -1)},
        })

    return {"type": "FeatureCollection", "features": features}


def get_building_coverage_components_geojson(conn, city_id: int) -> dict:
    """Return bike_path_buildings as GeoJSON with component_id based on geometric buffer connectivity.

    Algorithm:
    1. Buffer all bike_paths geometries by 150m (PostGIS geography for metric units)
    2. ST_Union the buffers to merge overlapping areas
    3. ST_Dump to split into separate polygons (= disconnected components)
    4. Rank by area descending (component_id 0 = largest)
    5. Spatial join bike_path_buildings; buildings not touching any buffer get component_id -1
    """
    import json

    with conn.cursor() as cur:
        cur.execute(
            """
            WITH bike_lanes AS (
                SELECT geometry FROM features
                WHERE feature_type = 'bike_paths' AND city_id = %s
            ),
            buffered AS (
                SELECT ST_Buffer(geometry::geography, 150)::geometry AS buf
                FROM bike_lanes
            ),
            unioned AS (
                SELECT (ST_Dump(ST_Union(buf))).geom AS component_geom
                FROM buffered
            ),
            ranked AS (
                SELECT component_geom,
                       (ROW_NUMBER() OVER (ORDER BY ST_Area(component_geom::geography) DESC) - 1)::integer AS component_id
                FROM unioned
            ),
            buildings AS (
                SELECT id, geometry, ST_AsGeoJSON(geometry) AS geojson
                FROM features
                WHERE feature_type = 'bike_path_buildings' AND city_id = %s
            )
            SELECT b.id, b.geojson, COALESCE(MIN(r.component_id), -1) AS component_id
            FROM buildings b
            LEFT JOIN ranked r ON ST_Intersects(b.geometry, r.component_geom)
            GROUP BY b.id, b.geojson
            """,
            (city_id, city_id),
        )
        rows = cur.fetchall()

    features = []
    for building_id, geojson_str, component_id in rows:
        features.append({
            "type": "Feature",
            "geometry": json.loads(geojson_str),
            "properties": {"building_id": building_id, "component_id": component_id},
        })

    return {"type": "FeatureCollection", "features": features}


def get_edge_building_coverage(conn, city_id: int) -> list:
    """Return per-edge building counts for the cycling network.

    For each cycleway edge: return pre-computed building_count
    (calculated during feature ingestion) and return
    [{edge_id, length_m, building_count}].  Used to histogram edge
    effectiveness (buildings/km) on the client side.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id                  AS edge_id,
                length              AS length_m,
                building_count
            FROM edges
            WHERE city_id = %s
              AND highway LIKE '%%cycleway%%'
              AND length  > 0
            ORDER BY id
            """,
            (city_id,),
        )
        rows = cur.fetchall()

    return [
        {"edge_id": row[0], "length_m": float(row[1]), "building_count": int(row[2])}
        for row in rows
    ]


def get_gcc_coverage(conn, city_id: int) -> dict:
    """Compute the Biggest Connected Component (GCC) of the cycling network.

    Returns the fraction of cycling-network km in the largest connected component,
    plus the absolute km and number of isolated components.
    """
    import networkx as nx

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u, v, length
            FROM edges
            WHERE city_id = %s AND highway LIKE '%%cycleway%%'
            """,
            (city_id,),
        )
        edges = cur.fetchall()

    if not edges:
        return {"gcc_fraction": None, "gcc_km": None, "total_km": None, "n_components": 0}

    G = nx.Graph()
    for u, v, length in edges:
        w = float(length or 0)
        if G.has_edge(u, v):
            G[u][v]["weight"] = max(G[u][v]["weight"], w)
        else:
            G.add_edge(u, v, weight=w)

    components = list(nx.connected_components(G))
    n_components = len(components)
    total_km = sum(d["weight"] for _, _, d in G.edges(data=True)) / 1000.0

    gcc_nodes = max(components, key=len)
    gcc_subgraph = G.subgraph(gcc_nodes)
    gcc_km = sum(d["weight"] for _, _, d in gcc_subgraph.edges(data=True)) / 1000.0

    return {
        "gcc_fraction": gcc_km / total_km if total_km > 0 else None,
        "gcc_km": gcc_km,
        "total_km": total_km,
        "n_components": n_components,
    }
