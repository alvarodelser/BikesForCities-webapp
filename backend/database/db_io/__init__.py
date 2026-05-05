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
    refresh_city_modes,
    update_city_wikidata,
    get_all_cities,
    get_city_center,
    city_exists,
    get_city_id_by_name,
    get_city_details,
    get_city_bounds,
    get_ingestion_status,
    upsert_ingestion_status,
    check_prerequisites,
    put_historical_mayors,
    put_city_elections,
    put_city_councilors,
    put_city_budgets,
    put_city_budget_categories,
    get_city_budgets,
    get_infra_budget,
    get_historical_mayors,
    get_city_elections_data,
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
    get_gcc_coverage,
    get_cycling_components_geojson,
    get_building_coverage_components_geojson,
    get_edge_building_coverage,
)

from .trips import (
    put_trips,
    count_trips,
    count_unrouted_trips,
    get_unrouted_trip_groups,
    city_has_real_trips,
    get_paginated_trips,
    get_trip_stats,
)

from .paths import (
    get_or_create_shortest_path,
    put_map_matched_path,
    put_path_edges,
    put_path_nodes,
    link_trip_to_path,
    bulk_link_trips_to_path,
)

from .routes import (
    count_routes,          # alias → count_trips (backward compat)
    get_trips_without_path,
)

from .features import (
    put_features,
    get_features,
    count_features,
    get_paginated_features,
    get_building_coverage_fraction,
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
    compute_station_building_coverages,
    get_station_building_coverage,
)

from .traffic import (
    upsert_edge_traffic,
    upsert_edge_traffic_for_city,
    get_traffic_modes,
    get_best_traffic_mode,
    get_edge_traffic,
    get_traffic_stats,
    get_max_traffic_edge,
    get_latest_traffic_month,
    has_traffic,
    get_traffic_infra_coverage,
    get_route_histogram,
)

from .edge_routes import (
    get_edge_route_traces,
    get_edge_route_od,
    count_edge_routes,
)

from .accidents import (
    get_accidents_geojson,
)

from .scores import (
    compute_mode_scores,
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
    get_station_monthly_agg,
)

__all__ = [
    # Connection
    "connect_db", "check_alive",
    # Cities
    "get_all_cities", "get_city_center",
    "city_exists", "get_city_id_by_name", "get_city_details", "get_city_bounds",
    "get_or_create_city", "put_city_modes", "get_city_modes", "refresh_city_modes", "update_city_wikidata",
    "get_ingestion_status", "upsert_ingestion_status", "check_prerequisites",
    "put_historical_mayors", "put_city_elections", "put_city_councilors",
    "put_city_budgets", "put_city_budget_categories", "get_city_budgets",
    "get_infra_budget", "get_historical_mayors", "get_city_elections_data",
    # graph
    "put_nodes", "put_edges", "get_nodes", "get_edges",
    "get_edge_id_map", "count_nodes", "count_edges",
    "get_paginated_nodes", "get_paginated_edges", "get_highway_distribution",
    "get_station_reachability", "compute_all_reach_coverages",
    "get_gcc_coverage", "get_cycling_components_geojson", "get_building_coverage_components_geojson",
    "get_edge_building_coverage",
    # trips
    "put_trips", "count_trips", "count_unrouted_trips", "get_unrouted_trip_groups",
    "city_has_real_trips", "get_paginated_trips", "get_trip_stats",
    # paths
    "get_or_create_shortest_path", "put_map_matched_path",
    "put_path_edges", "put_path_nodes",
    "link_trip_to_path", "bulk_link_trips_to_path",
    # routes (join table helpers + backward-compat alias)
    "count_routes", "get_trips_without_path",
    # features
    "put_features", "get_features", "count_features", "get_paginated_features",
    "get_building_coverage_fraction",
    # stations
    "get_stations", "get_paginated_stations", "has_station_readings_for_month",
    "get_nearby_unmerged_station", "upsert_stations", "insert_station_readings",
    "get_station_hourly_availability", "update_station_reach_coverage",
    "get_station_building_coverage",
    # traffic
    "upsert_edge_traffic", "upsert_edge_traffic_for_city",
    "get_traffic_modes", "get_best_traffic_mode",
    "get_edge_traffic", "get_traffic_stats", "get_max_traffic_edge",
    "get_latest_traffic_month", "has_traffic",
    "get_traffic_infra_coverage", "get_route_histogram",
    # edge routes
    "get_edge_route_traces", "get_edge_route_od", "count_edge_routes",
    # accidents
    "get_accidents_geojson",
    # scores
    "compute_mode_scores",
    # metrics
    "get_skellam_readings_diffs", "get_station_merge_map", "get_citybikes_network_id",
    "update_station_metrics", "upsert_station_monthly", "get_station_monthly_flow",
    "upsert_station_actual_trips", "upsert_city_actual_trips", "get_city_actual_vs_estimated",
    "upsert_estimated_trips_interval",
    "get_city_months_with_station_data", "calculate_osm_metrics",
    "get_total_active_stations", "upsert_city_metrics",
    "get_station_monthly_agg",
]
