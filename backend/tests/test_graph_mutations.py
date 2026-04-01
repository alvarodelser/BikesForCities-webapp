import pytest
from backend.database.db_io.cities import get_or_create_city
from backend.database.db_io.graph import put_nodes, put_edges, count_nodes, count_edges

class DummyGeom:
    def __init__(self, wkt_str):
        self.wkt = wkt_str

def test_put_nodes(transactional_db):
    city_id = get_or_create_city(transactional_db, name="NodesTestCity")
    
    nodes = [
        # (city_id, id, osmid, lat, lon, geom_wkt, street_count)
        (city_id, 1001, 1001, 45.0, 90.0, "POINT(90.0 45.0)", 3),
        (city_id, 1002, 1002, 45.1, 90.1, "POINT(90.1 45.1)", 2),
    ]
    
    put_nodes(transactional_db, nodes)
    
    assert count_nodes(transactional_db, city_id) == 2
    
    # Test ON CONFLICT (id) DO NOTHING
    put_nodes(transactional_db, [(city_id, 1001, 1001, 45.0, 90.0, "POINT(90.0 45.0)", 3)])
    assert count_nodes(transactional_db, city_id) == 2

def test_put_edges_respects_unique_constraints(transactional_db):
    city_id = get_or_create_city(transactional_db, name="EdgesTestCity")
    
    # Insert prerequisite nodes first to satisfy FK v AND u
    nodes = [
        (city_id, 2001, 2001, 45.0, 90.0, "POINT(90.0 45.0)", 3),
        (city_id, 2002, 2002, 45.1, 90.1, "POINT(90.1 45.1)", 2),
    ]
    put_nodes(transactional_db, nodes)
    
    # (city_id, osmid, u, v, k, geom, highway, name, length, width,
    #  maxspeed, lanes, oneway, tunnel, bridge)
    edge_geom = DummyGeom("LINESTRING(90.0 45.0, 90.1 45.1)")
    edges = [
        (city_id, 3001, 2001, 2002, 0, edge_geom, "residential", "Main St", 150.5, 5.0,
         [50], [2], False, False, False),
        (city_id, 3002, 2002, 2001, 0, edge_geom, "residential", "Main St", 150.5, 5.0,
         [50], [2], False, False, False),
    ]
    
    put_edges(transactional_db, edges)
    
    assert count_edges(transactional_db, city_id) == 2
    
    # Test ON CONFLICT (u, v, k) DO NOTHING
    # Re-insert the exact same edge tuple
    put_edges(transactional_db, [edges[0]])
    
    assert count_edges(transactional_db, city_id) == 2
