"""Tests for edge route queries."""
import pytest
import json
from backend.database.db_io import get_all_cities, get_edge_route_traces, get_edge_route_od
from backend.database.db_io import get_paginated_edges


def _get_test_edge_id(conn):
    """Return an edge_id that has at least one route, or None."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT edge_id FROM route_edges LIMIT 1"
        )
        row = cur.fetchone()
        return row[0] if row else None


def test_get_edge_route_traces_returns_list(db_connection):
    edge_id = _get_test_edge_id(db_connection)
    if edge_id is None:
        pytest.skip("No route_edges in DB")
    cities = get_all_cities(db_connection)
    city_id = cities[0][0]
    result = get_edge_route_traces(db_connection, city_id, edge_id, limit=10)
    assert isinstance(result, list)
    for geom_str in result:
        geom = json.loads(geom_str)
        assert geom["type"] in ("LineString", "MultiLineString")


def test_get_edge_route_od_returns_pairs(db_connection):
    edge_id = _get_test_edge_id(db_connection)
    if edge_id is None:
        pytest.skip("No route_edges in DB")
    cities = get_all_cities(db_connection)
    city_id = cities[0][0]
    result = get_edge_route_od(db_connection, city_id, edge_id, limit=10)
    assert isinstance(result, list)
    for row in result:
        assert "origin_lon" in row
        assert "origin_lat" in row
        assert "dest_lon" in row
        assert "dest_lat" in row
        assert -180 <= row["origin_lon"] <= 180
        assert -90  <= row["origin_lat"] <= 90


def test_get_edge_route_traces_respects_limit(db_connection):
    edge_id = _get_test_edge_id(db_connection)
    if edge_id is None:
        pytest.skip("No route_edges in DB")
    cities = get_all_cities(db_connection)
    city_id = cities[0][0]
    result = get_edge_route_traces(db_connection, city_id, edge_id, limit=2)
    assert len(result) <= 2


def test_get_edge_route_traces_unknown_edge_returns_empty(db_connection):
    cities = get_all_cities(db_connection)
    city_id = cities[0][0]
    result = get_edge_route_traces(db_connection, city_id, edge_id=999999999, limit=10)
    assert result == []
