"""
db_io package – organised database I/O modules.

Public surface re-exported here for convenience:
  from backend.database.db_io import connect_db, get_all_cities, ...
"""

from .connection import connect_db, check_alive

from .cities import (
    get_or_create_city,
    put_city_modes,
    get_city_modes,
    update_city_wikidata,
    get_all_cities,
    get_city_center,
    city_exists,
    get_city_id_by_name,
    get_city_details,
    get_city_bounds,
    get_ingestion_status,
    upsert_ingestion_status,
    put_historical_mayors,
    put_city_elections,
    put_city_councilors,
    put_city_budgets,
    get_city_budgets,
)

from .graph import (
    put_nodes,
    put_edges,
    get_nodes,
    get_edges,
    get_edge_id_map,
    count_nodes,
    count_edges,
    get_paginated_nodes,
    get_paginated_edges,
    get_highway_distribution,
    get_station_reachability,
    compute_all_reach_coverages,
)

from .routes import (
    put_routes,
    put_route_edges,
    put_route_edges_with_order,
    get_routes_without_edges,
    get_unprocessed_route_groups,
    mark_routes_processed,
    count_routes,
    count_unprocessed_routes,
    get_paginated_routes,
    get_route_stats,
)

from .features import (
    put_features,
    get_features,
    count_features,
    get_paginated_features,
)

from .stations import (
    get_stations,
    get_paginated_stations,
    has_station_readings_for_month,
    get_nearby_unmerged_station,
    upsert_stations,
    insert_station_readings,
    get_station_hourly_availability,
    update_station_reach_coverage,
)

from .traffic import (
    upsert_edge_traffic,
    upsert_edge_traffic_for_city,
    get_edge_traffic,
    get_latest_traffic_month,
    has_traffic,
)

from .metrics import (
    get_skellam_readings_diffs,
    get_station_merge_map,
    get_citybikes_network_id,
    update_station_metrics,
    upsert_station_monthly,
    get_station_monthly_flow,
    upsert_station_actual_trips,
    upsert_city_actual_trips,
    get_city_actual_vs_estimated,
    upsert_estimated_trips_interval,
    get_city_months_with_station_data,
    calculate_osm_metrics,
    get_total_active_stations,
    upsert_city_metrics,
)

__all__ = [
    # Connection
    "connect_db", "check_alive",
    # Cities
    "get_all_cities", "get_city_center",
    "city_exists", "get_city_id_by_name", "get_city_details", "get_city_bounds",
    "get_or_create_city", "put_city_modes", "get_city_modes", "update_city_wikidata",
    "get_ingestion_status", "upsert_ingestion_status",
    "put_historical_mayors", "put_city_elections", "put_city_councilors",
    "put_city_budgets", "get_city_budgets",
    # graph
    "put_nodes", "put_edges", "get_nodes", "get_edges",
    "get_edge_id_map", "count_nodes", "count_edges",
    "get_paginated_nodes", "get_paginated_edges", "get_highway_distribution",
    "get_station_reachability", "compute_all_reach_coverages",
    # routes
    "put_routes", "put_route_edges", "put_route_edges_with_order",
    "get_routes_without_edges", "get_unprocessed_route_groups",
    "mark_routes_processed", "count_routes",
    "get_paginated_routes", "get_route_stats", "count_unprocessed_routes",
    # features
    "put_features", "get_features", "count_features", "get_paginated_features",
    # stations
    "get_stations", "get_paginated_stations", "has_station_readings_for_month",
    "get_nearby_unmerged_station", "upsert_stations", "insert_station_readings",
    "get_station_hourly_availability", "update_station_reach_coverage",
    # traffic
    "upsert_edge_traffic", "upsert_edge_traffic_for_city",
    "get_edge_traffic", "get_latest_traffic_month", "has_traffic",
    # metrics
    "get_skellam_readings_diffs", "get_station_merge_map", "get_citybikes_network_id",
    "update_station_metrics", "upsert_station_monthly", "get_station_monthly_flow",
    "upsert_station_actual_trips", "upsert_city_actual_trips", "get_city_actual_vs_estimated",
    "upsert_estimated_trips_interval",
    "get_city_months_with_station_data", "calculate_osm_metrics",
    "get_total_active_stations", "upsert_city_metrics",
]
