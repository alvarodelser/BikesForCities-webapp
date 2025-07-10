from typing import List, Tuple, Any
import networkx as nx
from shapely import wkt
from shapely.geometry import Point, LineString
from app.database.network_io import get_edges, get_nodes

# Extract node info from graph
def extract_nodes(graph: nx.MultiDiGraph, network_id: int) -> List[Tuple[int, int, int, float, float, str, int]]:
    """Return a list of node tuples ready for bulk-insert.

    The expected shape is **7 values** to match `put_nodes()`:

        (network_id, id, osmid, lat, lon, geom_wkt, street_count)
    """

    nodes: List[Tuple[int, int, int, float, float, str, int]] = []
    for node_id, data in graph.nodes(data=True):
        lat = data.get("y")
        lon = data.get("x")
        point_wkt = Point(lon, lat).wkt
        street_count = data.get("street_count")

        nodes.append((
            network_id,   # FK to networks
            node_id,      # id (primary key)
            node_id,      # osmid – using same value as id for now
            lat,
            lon,
            point_wkt,
            street_count
        ))
    return nodes


def parse_width(data: dict) -> float | None:
    width = data.get("width") or data.get("est_width")
    try:
        return float(width)
    except (ValueError, TypeError):
        return None

def parse_maxspeed(data: dict) -> List[int] | None:
    maxspeed = data.get("maxspeed")
    if maxspeed is None:
        return None

    if isinstance(maxspeed, int):
        return [maxspeed]

    if isinstance(maxspeed, str):
        try:
            return [int(s.strip()) for s in maxspeed.split('|') if s.strip().isdigit()]
        except ValueError:
            return None
    return None

def parse_lanes(data: dict) -> List[int] | None:
    lanes = data.get("lanes")
    if lanes is None:
        return None

    if isinstance(lanes, int):
        return [lanes]

    if isinstance(lanes, str):
        try:
            return [int(s.strip()) for s in lanes.split('|') if s.strip().isdigit()]
        except ValueError:
            return None
    return None

# Extract edge info from graph
def extract_edges(graph: nx.MultiDiGraph, network_id: int) -> List[Tuple[Any, ...]]:
    """Return a list of edge tuples ready for bulk-insert.

    Expected length **15** to match `put_edges()`:

        (network_id, osmid, u, v, k, geom, highway, name, length,
         width, maxspeed, lanes, oneway, tunnel, bridge)
    """

    edges: List[Tuple[Any, ...]] = []
    for u, v, k, data in graph.edges(keys=True, data=True):
        osmid = data.get("osmid")
        if isinstance(osmid, list):
            osmid = osmid[0]

        # Ensure geometry exists
        geom = data.get("geometry")
        if not geom:
            geom = LineString([
                (graph.nodes[u]["x"], graph.nodes[u]["y"]),
                (graph.nodes[v]["x"], graph.nodes[v]["y"])
            ])

        # Normalize metadata types
        highway = str(data.get("highway")) if data.get("highway") else None
        name = str(data.get("name")) if data.get("name") else None
        length = float(data.get("length")) if data.get("length") else None
        width = parse_width(data)
        maxspeed = parse_maxspeed(data)
        lanes = parse_lanes(data)
        oneway = data.get("oneway", False)
        tunnel = "tunnel" in data
        bridge = "bridge" in data

        edge = (
            network_id,
            osmid,
            u,
            v,
            k,
            geom,
            highway,
            name,
            length,
            width,
            maxspeed,
            lanes,
            oneway,
            tunnel,
            bridge
        )
        edges.append(edge)
    return edges


def build_graph(conn, network_id: int) -> nx.MultiDiGraph:
    """
    Reconstruct a NetworkX graph from database data.
    
    Args:
        conn: Database connection
        network_id: ID of the network to reconstruct
        
    Returns:
        nx.MultiDiGraph: Reconstructed graph with nodes and edges
    """
    graph = nx.MultiDiGraph()
    graph.graph["crs"] = "EPSG:4326"

    # Add nodes
    for node_id, lat, lon, geom_wkt, street_count in get_nodes(conn, network_id):
        graph.add_node(node_id, x=lon, y=lat, street_count=street_count)

    # Add edges
    for (
        osmid, u, v, k, geom_wkt,
        highway, name, length, width,
        maxspeed, lanes, oneway, tunnel, bridge
    ) in get_edges(conn, network_id):
        geom = wkt.loads(geom_wkt)
        graph.add_edge(u, v, key=k, **{
            "osmid": osmid,
            "geometry": geom,
            "highway": highway,
            "name": name,
            "length": length,
            "width": width,
            "maxspeed": maxspeed,
            "lanes": lanes,
            "oneway": oneway,
            "tunnel": tunnel,
            "bridge": bridge
        })
    
    return graph
