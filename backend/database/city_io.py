"""
city_io.py – DEPRECATED shim.

All functions have been moved to backend.database.db_io.
This module re-exports everything for backwards compatibility with existing
importers. New code should import directly from db_io.
"""
# ruff: noqa: F401
from backend.database.db_io import (  # noqa: F401
    connect_db,
    get_or_create_city,
    put_city_modes,
    update_city_wikidata,
    get_ingestion_status,
    upsert_ingestion_status,
    put_historical_mayors,
    put_city_elections,
    put_city_councilors,
    put_city_budgets,
    get_all_cities,
    get_city_center,
    put_nodes,
    put_edges,
    get_nodes,
    get_edges,
    get_edge_id_map,
    count_nodes,
    count_edges,
    put_routes,
    put_route_edges,
    put_route_edges_with_order,
    get_routes_without_edges,
    get_unprocessed_route_groups,
    mark_routes_processed,
    count_routes,
    put_features,
    get_features,
    count_features,
    get_stations,
    upsert_edge_traffic,
    upsert_edge_traffic_for_city,
    get_edge_traffic,
    get_latest_traffic_month,
    has_traffic,
)