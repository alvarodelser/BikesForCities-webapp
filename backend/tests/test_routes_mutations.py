import pytest
from datetime import datetime
from backend.database.db_io.cities import get_or_create_city
from backend.database.db_io.graph import put_nodes, put_edges
from backend.database.db_io.routes import (
    put_routes,
    put_route_edges,
    mark_routes_processed,
    get_routes_without_edges,
    get_unprocessed_route_groups,
    count_routes
)

class DummyGeom:
    def __init__(self, wkt_str):
        self.wkt = wkt_str

def test_put_routes_and_edges(transactional_db):
    city_id = get_or_create_city(transactional_db, name="RoutesTestCity")
    
    # Prerequisite nodes and edges
    nodes = [
        (city_id, 4001, 4001, 45.0, 90.0, "POINT(90.0 45.0)", 3),
        (city_id, 4002, 4002, 45.1, 90.1, "POINT(90.1 45.1)", 2),
    ]
    put_nodes(transactional_db, nodes)
    
    edge_geom = DummyGeom("LINESTRING(90.0 45.0, 90.1 45.1)")
    edges = [
        (city_id, 5001, 4001, 4002, 0, edge_geom, "residential", "Main St", 150.5, 5.0,
         [50], [2], False, False, False),
    ]
    put_edges(transactional_db, edges)
    
    # Get the generated edge ID
    with transactional_db.cursor() as cur:
        cur.execute("SELECT id FROM edges WHERE city_id = %s", (city_id,))
        edge_id = cur.fetchone()[0]

    # (city_id, id_trip, origin_node, dest_node, strategy, trip_minutes,
    #  datetime_unlock, id_bike, origin_lat, origin_lon, dest_lat, dest_lon,
    #  datetime_lock)
    routes_data = [
        (city_id, "TRIP_001", 4001, 4002, "shortest", 5.5, 
         datetime(2024, 1, 1, 10, 0), 12345, 45.0, 90.0, 45.1, 90.1, 
         datetime(2024, 1, 1, 10, 5))
    ]
    
    route_map = put_routes(transactional_db, routes_data)
    assert "TRIP_001" in route_map
    route_id = route_map["TRIP_001"]
    
    assert count_routes(transactional_db, city_id) == 1
    
    # Put route edges
    put_route_edges(transactional_db, [(route_id, edge_id)])
    
    # Verify processing logic
    unprocessed = get_unprocessed_route_groups(transactional_db, city_id)
    assert len(unprocessed) == 1
    assert unprocessed[0][0] == 4001 # origin_node
    
    mark_routes_processed(transactional_db, [route_id])
    assert len(get_unprocessed_route_groups(transactional_db, city_id)) == 0

def test_get_routes_without_edges(transactional_db):
    city_id = get_or_create_city(transactional_db, name="RouteNoEdgesCity")
    
    routes_data = [
        (city_id, "TRIP_NO_EDGE", None, None, "shortest", 2.0, 
         datetime.now(), 999, 45.0, 90.0, 45.1, 90.1, datetime.now())
    ]
    put_routes(transactional_db, routes_data)
    
    missing = get_routes_without_edges(transactional_db, city_id)
    assert len(missing) == 1
    assert missing[0][1] == "TRIP_NO_EDGE"
