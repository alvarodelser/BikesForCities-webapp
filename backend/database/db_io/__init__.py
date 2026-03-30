"""
db_io package – organised database I/O modules.

Public surface re-exported here for convenience:
  from backend.database.db_io import connect_db, get_all_cities, ...
"""

from .connection import connect_db

from .cities import (
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
)

from .graph import (
    put_nodes,
    put_edges,
    get_nodes,
    get_edges,
    get_edge_id_map,
    count_nodes,
    count_edges,
)

from .routes import (
    put_routes,
    put_route_edges,
    put_route_edges_with_order,
    get_routes_without_edges,
    get_unprocessed_route_groups,
    mark_routes_processed,
    count_routes,
)

from .features import (
    put_features,
    get_features,
    count_features,
)

from .stations import (
    get_stations,
)

from .traffic import (
    upsert_edge_traffic,
    upsert_edge_traffic_for_city,
    get_edge_traffic,
    get_latest_traffic_month,
    has_traffic,
)

__all__ = [
    # connection
    "connect_db",
    # cities
    "get_or_create_city", "put_city_modes", "update_city_wikidata",
    "get_ingestion_status", "upsert_ingestion_status",
    "put_historical_mayors", "put_city_elections", "put_city_councilors",
    "put_city_budgets", "get_all_cities", "get_city_center",
    # graph
    "put_nodes", "put_edges", "get_nodes", "get_edges",
    "get_edge_id_map", "count_nodes", "count_edges",
    # routes
    "put_routes", "put_route_edges", "put_route_edges_with_order",
    "get_routes_without_edges", "get_unprocessed_route_groups",
    "mark_routes_processed", "count_routes",
    # features
    "put_features", "get_features", "count_features",
    # stations
    "get_stations",
    # traffic
    "upsert_edge_traffic", "upsert_edge_traffic_for_city",
    "get_edge_traffic", "get_latest_traffic_month", "has_traffic",
]
