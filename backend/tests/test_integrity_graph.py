"""
test_integrity_graph.py – Data-integrity checks for the spatial graph.

Covers: node/edge structure, node and edge proximity to city centre,
edge traffic trip-count bounds, and paginated endpoint consistency.
"""
import math
import pytest

from backend.database.db_io import (
    get_all_cities,
    get_nodes,
    get_edges,
    get_edge_traffic,
    get_paginated_nodes,
    get_paginated_edges,
    get_paginated_trips,
    get_trip_stats,
)

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Node structure (migrated + corrected from test_data_integrity)
# ---------------------------------------------------------------------------
# get_nodes returns: (id, lat, lon, geom_wkt, street_count)
#   index:             0    1    2      3           4

def test_nodes_structure(db_connection):
    """Node tuples have valid lat/lon values."""
    cities = get_all_cities(db_connection)
    for city in cities:
        nodes = get_nodes(db_connection, city[0])
        if not nodes:
            continue
        for node in nodes[:50]:   # sample first 50
            lat, lon = node[1], node[2]
            assert -90 <= lat <= 90, f"Node lat {lat} out of range"
            assert -180 <= lon <= 180, f"Node lon {lon} out of range"


def test_nodes_near_city_center(db_connection):
    """All nodes must lie within (city radius + 10 km) of the city centre."""
    cities = get_all_cities(db_connection)
    for city in cities:
        city_id, name = city[0], city[1]
        center_lat, center_lon, radius = city[4], city[5], city[6]
        if None in (center_lat, center_lon, radius):
            continue
        nodes = get_nodes(db_connection, city_id)
        if not nodes:
            continue
        threshold = radius + 10.0
        for node in nodes:
            lat, lon = node[1], node[2]
            dist = _haversine(center_lat, center_lon, lat, lon)
            assert dist <= threshold, (
                f"{name}: node ({lat:.4f},{lon:.4f}) is {dist:.1f} km from centre "
                f"(limit {threshold:.1f} km)"
            )


# ---------------------------------------------------------------------------
# Edge structure (migrated)
# ---------------------------------------------------------------------------
# get_edges returns: (osmid, u, v, k, geom_wkt, highway, name, length, ...)

def test_edges_structure(db_connection):
    """Edge tuples must have at least 4 fields."""
    cities = get_all_cities(db_connection)
    for city in cities:
        edges = get_edges(db_connection, city[0])
        if not edges:
            continue
        assert len(edges[0]) >= 4, f"{city[1]}: edge tuple has fewer than 4 fields"


def test_edges_centroid_near_city_center(db_connection):
    """Edge centroids (via PostGIS) must lie within (city radius + 10 km) of the city centre."""
    cities = get_all_cities(db_connection)
    for city in cities:
        city_id, name = city[0], city[1]
        center_lat, center_lon, radius = city[4], city[5], city[6]
        if None in (center_lat, center_lon, radius):
            continue
        # Sample 200 edges to keep it fast
        with db_connection.cursor() as cur:
            cur.execute(
                """
                SELECT ST_Y(ST_Centroid(geom)) AS clat,
                       ST_X(ST_Centroid(geom)) AS clon
                FROM edges
                WHERE city_id = %s
                LIMIT 200
                """,
                (city_id,),
            )
            rows = cur.fetchall()
        if not rows:
            continue
        threshold = radius + 10.0
        for clat, clon in rows:
            if clat is None or clon is None:
                continue
            dist = _haversine(center_lat, center_lon, clat, clon)
            assert dist <= threshold, (
                f"{name}: edge centroid ({clat:.4f},{clon:.4f}) is {dist:.1f} km from centre "
                f"(limit {threshold:.1f} km)"
            )


# ---------------------------------------------------------------------------
# Edge traffic (migrated + extended)
# ---------------------------------------------------------------------------
# get_edge_traffic returns: (edge_id, trip_count, month)

def test_edge_traffic_structure(db_connection):
    """Traffic records have non-negative trip_count."""
    cities = get_all_cities(db_connection)
    has_data = False
    for city in cities:
        records = get_edge_traffic(db_connection, city[0])
        if records:
            has_data = True
            for edge_id, trip_count, month in records[:20]:
                if trip_count is not None:
                    assert trip_count >= 0, f"edge {edge_id}: negative trip_count {trip_count}"
    if not has_data:
        pytest.skip("No traffic data in the database.")


def test_edge_traffic_trip_count_sensible(db_connection):
    """Every trip_count value must be in [0, 1 000 000]."""
    cities = get_all_cities(db_connection)
    has_data = False
    for city in cities:
        records = get_edge_traffic(db_connection, city[0])
        if records:
            has_data = True
            for edge_id, trip_count, month in records:
                assert 0 <= trip_count <= 1_000_000, (
                    f"{city[1]}: edge {edge_id} month {month} trip_count={trip_count} "
                    f"out of [0, 1_000_000]"
                )
    if not has_data:
        pytest.skip("No traffic data in the database.")


# ---------------------------------------------------------------------------
# Pagination consistency (migrated from test_data_integrity)
# ---------------------------------------------------------------------------

def test_pagination_nodes_edges_routes(db_connection):
    """Paginated node/edge counts must match full-table counts; route stats are coherent."""
    cities = get_all_cities(db_connection)
    if not cities:
        pytest.skip("No cities available.")

    for city_id, *_ in cities[:5]:
        all_nodes = get_nodes(db_connection, city_id)
        page_nodes, total_nodes = get_paginated_nodes(db_connection, city_id, limit=50, offset=0)
        assert total_nodes == len(all_nodes)
        assert len(page_nodes) <= 50

        all_edges = get_edges(db_connection, city_id)
        page_edges, total_edges = get_paginated_edges(db_connection, city_id, limit=50, offset=0)
        assert total_edges == len(all_edges)
        assert len(page_edges) <= 50

        trips_page, trips_total = get_paginated_trips(db_connection, city_id, limit=50, offset=0)
        assert trips_total >= len(trips_page)
        if trips_total > 0:
            stats = get_trip_stats(db_connection, city_id)
            assert stats is not None
            if stats.get("avg_duration") is not None:
                assert stats["min_duration"] <= stats["avg_duration"] <= stats["max_duration"]
