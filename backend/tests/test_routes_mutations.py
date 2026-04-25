import pytest
from datetime import datetime
from backend.database.db_io.cities import get_or_create_city
from backend.database.db_io.graph import put_nodes, put_edges
from backend.database.db_io.trips import (
    put_trips,
    count_trips,
    count_unrouted_trips,
    get_unrouted_trip_groups,
)
from backend.database.db_io.paths import (
    get_or_create_shortest_path,
    put_path_edges,
    put_path_nodes,
    bulk_link_trips_to_path,
)
from backend.database.db_io.routes import (
    count_routes,
    get_trips_without_path,
)


class DummyGeom:
    def __init__(self, wkt_str):
        self.wkt = wkt_str


def test_put_trips_and_count(transactional_db):
    city_id = get_or_create_city(transactional_db, name="TripsTestCity")

    nodes = [
        (city_id, 4001, 4001, 45.0, 90.0, "POINT(90.0 45.0)", 3),
        (city_id, 4002, 4002, 45.1, 90.1, "POINT(90.1 45.1)", 2),
    ]
    put_nodes(transactional_db, nodes)

    trips_data = [
        (city_id, "TRIP_001", 4001, 4002, 5.5,
         datetime(2024, 1, 1, 10, 0), 12345, datetime(2024, 1, 1, 10, 5), "real"),
    ]
    put_trips(transactional_db, trips_data)
    assert count_trips(transactional_db, city_id) == 1
    assert count_routes(transactional_db, city_id) == 1  # backward-compat alias


def test_unrouted_trips(transactional_db):
    city_id = get_or_create_city(transactional_db, name="UnroutedCity")

    nodes = [
        (city_id, 5001, 5001, 46.0, 91.0, "POINT(91.0 46.0)", 2),
        (city_id, 5002, 5002, 46.1, 91.1, "POINT(91.1 46.1)", 2),
    ]
    put_nodes(transactional_db, nodes)

    trips_data = [
        (city_id, "TRIP_UNROUTED", 5001, 5002, 3.0,
         datetime(2024, 2, 1, 9, 0), 999, datetime(2024, 2, 1, 9, 3), "station_based"),
    ]
    put_trips(transactional_db, trips_data)

    assert count_unrouted_trips(transactional_db, city_id) == 1

    groups = get_unrouted_trip_groups(transactional_db, city_id, limit=10)
    assert len(groups) == 1
    assert groups[0][0] == 5001  # origin_node


def test_path_edges_and_link(transactional_db):
    city_id = get_or_create_city(transactional_db, name="PathEdgesCity")

    nodes = [
        (city_id, 6001, 6001, 47.0, 92.0, "POINT(92.0 47.0)", 3),
        (city_id, 6002, 6002, 47.1, 92.1, "POINT(92.1 47.1)", 2),
    ]
    put_nodes(transactional_db, nodes)

    edge_geom = DummyGeom("LINESTRING(92.0 47.0, 92.1 47.1)")
    edges = [
        (city_id, 7001, 6001, 6002, 0, edge_geom, "residential", "Test St", 150.5, 5.0,
         [50], [2], False, False, False),
    ]
    put_edges(transactional_db, edges)

    with transactional_db.cursor() as cur:
        cur.execute("SELECT id FROM edges WHERE city_id = %s", (city_id,))
        edge_id = cur.fetchone()[0]

    trips_data = [
        (city_id, "TRIP_PATH", 6001, 6002, 4.0,
         datetime(2024, 3, 1, 8, 0), 111, datetime(2024, 3, 1, 8, 4), "real"),
    ]
    put_trips(transactional_db, trips_data)

    with transactional_db.cursor() as cur:
        cur.execute("SELECT id FROM trips WHERE id_trip = 'TRIP_PATH'")
        trip_id = cur.fetchone()[0]

    path_id = get_or_create_shortest_path(transactional_db, city_id, 6001, 6002)
    put_path_edges(transactional_db, path_id, [(edge_id, 0)])
    put_path_nodes(transactional_db, path_id, [6001, 6002])
    bulk_link_trips_to_path(transactional_db, city_id, [trip_id], path_id)

    assert count_unrouted_trips(transactional_db, city_id) == 0


def test_trips_without_path(transactional_db):
    city_id = get_or_create_city(transactional_db, name="NoPathCity")

    nodes = [
        (city_id, 8001, 8001, 48.0, 93.0, "POINT(93.0 48.0)", 2),
        (city_id, 8002, 8002, 48.1, 93.1, "POINT(93.1 48.1)", 2),
    ]
    put_nodes(transactional_db, nodes)

    trips_data = [
        (city_id, "TRIP_NO_PATH", 8001, 8002, 2.0,
         datetime.now(), 777, datetime.now(), "real"),
    ]
    put_trips(transactional_db, trips_data)

    missing = get_trips_without_path(transactional_db, city_id)
    assert len(missing) == 1
    assert missing[0][1] == "TRIP_NO_PATH"
