# Database Dictionary

This document provides a detailed overview of the database schema for the Bikes for Cities project. It includes information about each table, its columns, the scripts that populate them, and how they are accessed via the API and `db_io` functions.

---

## 1. Core Infrastructure
Tables related to the physical city layout, the road network (graph), and geographic features.

### `cities`
Stores global metadata for each city in the system.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `010_load_cities.py`: PK. | `GET /cities`, `GET /status` | `out: get_all_cities` | `LandingPage`, `StatusPage`, `Navbar` |
| `name` | `010_load_cities.py`: Display name. | `GET /cities` | `in: get_or_create_city` | `LandingPage`, `Navbar` |
| `slug` | `010_load_cities.py`: URL identifier. | `GET /cities` | `in: get_or_create_city` | `CityPage` (URL Routing) |
| `alt_name` | `010_load_cities.py`: Alternative names. | `GET /cities` | `in: get_or_create_city` | `CityCard`, `Navbar` |
| `description` | `010_load_cities.py`: Brief description. | `GET /cities` | `in: get_or_create_city` | `CityCard` |
| `center_lat` | `010_load_cities.py`: Center latitude. | `GET /cities` | `out: get_city_center` | `CityPage` (Map Init) |
| `center_lon` | `010_load_cities.py`: Center longitude. | `GET /cities` | `out: get_city_center` | `CityPage` (Map Init) |
| `radius` | `010_load_cities.py`: City radius. | `GET /cities` | `out: get_city_center` | `CityCanvas` (Zoom logic) |
| `angle` | `010_load_cities.py`: Bounding box rotation. | `GET /cities` | `in: get_or_create_city` | `CityCanvas` (Map Rotate) |
| `population` | `011_load_wikidata.py`: Total population. | `GET /cities` | `in: update_city_wikidata` | `CityCard`, `ComparePage` |
| `website` | `011_load_wikidata.py`: Official website. | `GET /cities` | `in: update_city_wikidata` | `CityCard` |
| `mayor` | `011_load_wikidata.py`: Current mayor name. | `GET /cities` | `in: update_city_wikidata` | `CityCard` |
| `mayor_party` | `011_load_wikidata.py`: Current mayor's party. | `GET /cities` | `in: update_city_wikidata` | `CityCard`, `ComparePage` |
| `wikidata_id` | `011_load_wikidata.py`: Wikidata stable ID. | `GET /cities` | `in: update_city_wikidata` | (Ingestion only) |

### `city_modes`
Tracks available data modes (traffic, accidents, etc.) and pre-computed stats for each city.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `city_id` | `020_load_osm.py`: PK / FK to `cities`. | `GET /cities` | `in: put_city_modes` | `useLiveStats` |
| `infrastructure` | `020_load_osm.py`: Cycling network. | `GET /.../infra/stats`, `GET /status` | `out: get_city_modes` | `InfrastructureMode`, `StatusPage` |
| `traffic` | `refresh_city_modes()`: If traffic exist. | `GET /cities`, `GET /status` | `out: get_city_modes` | `TrafficMode`, `StatusPage` |
| `traffic_combinations` | `refresh_city_modes()`: JSON list. | `GET /cities`, `GET /status` | `out: get_city_modes` | `TrafficMode` (Selector) |
| `accidents` | `060_load_madrid_accidents.py`: Accidents. | `GET /cities`, `GET /status` | `out: get_city_modes` | `AccidentMode`, `StatusPage` |
| `stations` | `030_load_stations.py`: Bike-share. | `GET /cities`, `GET /status` | `out: get_city_modes` | `StationsMode`, `StatusPage` |
| `topography` | Manual/Internal: Topography flag. | `GET /cities`, `GET /status` | `out: get_city_modes` | `TerrainMode` |
| `intersections` | Manual/Internal: Intersections flag. | `GET /cities`, `GET /status` | `out: get_city_modes` | `StatusPage` |
| `forum` | Manual/Internal: Forum feature flag. | `GET /cities`, `GET /status` | `out: get_city_modes` | `StatusPage` |
| `gcc_fraction` | `021_calculate_infra_metrics.py`: % coverage. | `GET /.../infra/stats` | `out: get_gcc_coverage` | `CityCard`, `MapDesktop` |
| `gcc_km` | `021_calculate_infra_metrics.py`: GCC km. | `GET /.../infra/stats` | `out: get_gcc_coverage` | `CityCard`, `useInfraStats` |
| `total_cycling_km` | `021_calculate_infra_metrics.py`: Total km. | `GET /.../infra/stats` | `out: get_gcc_coverage` | `useInfraStats` |
| `n_components` | `021_calculate_infra_metrics.py`: Components. | `GET /.../infra/stats` | `out: get_gcc_coverage` | `useInfraStats` |

### `nodes`
OSM nodes representing intersections or points in the road graph.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `020_load_osm.py`: OSM Node ID (PK). | `GET /.../nodes`, `GET /status` | `in: put_nodes` | `StatusPage` |
| `city_id` | `020_load_osm.py`: FK to `cities`. | `GET /.../stats`, `GET /status` | `out: count_nodes` | `StatusPage` |
| `lat` | `020_load_osm.py`: Latitude. | `GET /.../nodes` | `out: get_paginated_nodes` | (Internal/Debugging) |
| `lon` | `020_load_osm.py`: Longitude. | `GET /.../nodes` | `out: get_paginated_nodes` | (Internal/Debugging) |
| `osmid` | `020_load_osm.py`: OSM original node ID. | `GET /.../nodes` | `out: get_paginated_nodes` | (Internal/Debugging) |
| `geom` | `020_load_osm.py`: PostGIS Point. | Internal filtering / BBox. | `in: put_nodes` | (Backend filter only) |
| `street_count` | `020_load_osm.py`: Incident streets. | `GET /.../nodes` | `out: get_paginated_nodes` | (Internal/Debugging) |

### `edges`
OSM edges representing road segments between nodes.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `020_load_osm.py`: Serial PK. | `GET /.../edges`, `GET /status` | `in: put_edges` | `StatusPage` |
| `city_id` | `020_load_osm.py`: FK to `cities`. | `GET /.../stats`, `GET /status` | `out: count_edges` | `StatusPage` |
| `osmid` | `020_load_osm.py`: OSM Way ID. | `GET /.../edges` | `out: get_edge_id_map` | (Internal mapping) |
| `u`, `v`, `k` | `020_load_osm.py`: Connectivity. | Internal routing. | `in: put_edges` | `TrafficLayer` (Trace visualization) |
| `geom` | `020_load_osm.py`: LineString. | `GET /.../edges/geojson` | `in: put_edges` | `TrafficLayer`, `AccidentsLayer` |
| `highway` | `020_load_osm.py`: OSM highway tag. | `GET /.../edges` | `out: get_highway_distribution` | `InfrastructureMode` |
| `name` | `020_load_osm.py`: Street name. | `GET /.../edges` | `out: get_paginated_edges` | `TrafficLayer` (Tooltips) |
| `length` | `020_load_osm.py`: Segment length. | `GET /.../infra/stats` | `out: calculate_osm_metrics` | `useInfraStats` |
| `width` | `020_load_osm.py`: Segment width. | `GET /.../edges` | `out: get_paginated_edges` | `TrafficLayer` |
| `maxspeed` | `020_load_osm.py`: Speed limit. | `GET /.../edges` | `out: get_paginated_edges` | `TrafficLayer` |
| `lanes` | `020_load_osm.py`: Number of lanes. | `GET /.../edges` | `out: get_paginated_edges` | `TrafficLayer` |
| `oneway` | `020_load_osm.py`: Oneway flag. | `GET /.../edges` | `out: get_paginated_edges` | `TrafficLayer` |
| `tunnel` | `020_load_osm.py`: Tunnel flag. | `GET /.../edges` | `out: get_paginated_edges` | `TrafficLayer` |
| `bridge` | `020_load_osm.py`: Bridge flag. | `GET /.../edges` | `out: get_paginated_edges` | `TrafficLayer` |
| `building_count`| `020_load_osm.py`: Count. | `GET /.../infra/edge-building-coverage` | `out: get_edge_building_coverage` | `BuildingsDensityHistogram` |
| `component_id` | `020_load_osm.py`: GCC ranking. | `GET /.../infra/components` | `out: get_cycling_components_geojson` | `InfrastructureMode` |

### `features`
Generic OSM features (buildings, cycleways, etc.) for spatial analysis.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `020_load_osm.py`: Serial PK. | `GET /.../features`, `GET /status` | `in: put_features` | `StatusPage` |
| `feature_type` | `020_load_osm.py`: e.g. 'buildings'. | `GET /.../features`, `GET /status` | `out: count_features` | `StatusPage` |
| `city_id` | `020_load_osm.py`: FK to `cities`. | `GET /.../stats`, `GET /status` | `out: get_paginated_features` | `StatusPage` |
| `geometry` | `020_load_osm.py`: Polygon. | `GET /.../geojson`, `GET /.../infra/building-coverage` | `in: put_features` | `StationsLayer` (Reach) |
| `tags` | `020_load_osm.py`: OSM metadata JSONB. | `GET /.../features` | `out: get_paginated_features` | `InfrastructureMode` |
| `component_id` | `020_load_osm.py`: Connectivity. | `GET /.../infra/building-coverage` | `out: get_paginated_features` | `InfrastructureMode` |
| `extracted_at` | `020_load_osm.py`: Timestamp. | `GET /.../features` | `out: get_paginated_features` | `StatusPage` |

---

## 2. Trips & Routing
Tables that store individual movement records and the computed paths through the graph.

### `trips`
Observations of individual trips (Real or Synthetic).
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `04x_scripts`: PK. | `GET /.../trips`, `GET /status` | `in: put_trips` | `StatusPage` |
| `id_trip` | `040_load_madrid_trips.py`: ID. | `GET /.../trips` | `in: put_trips` | `TrafficLayer` |
| `origin_node` | `050_scripts`: Start node. | `GET /.../trips`, `GET /.../routes` | `out: get_unrouted_trip_groups` | `TrafficLayer` (Trace) |
| `dest_node` | `050_scripts`: End node. | `GET /.../trips`, `GET /.../routes` | `out: get_unrouted_trip_groups` | `TrafficLayer` (Trace) |
| `city_id` | `04x_scripts`: FK to `cities`. | `GET /.../stats`, `GET /status` | `out: get_paginated_trips` | `StatusPage` |
| `trip_minutes` | `040_load_madrid_trips.py`: Duration. | `GET /.../trips` | `out: get_trip_stats` | `useTrafficStats` |
| `datetime_unlock`| `040_load_madrid_trips.py`: Start. | `GET /.../trips` | `out: get_paginated_trips` | `TrafficLayer` |
| `datetime_lock` | `040_load_madrid_trips.py`: End. | `GET /.../trips` | `out: get_paginated_trips` | `TrafficLayer` |
| `id_bike` | `040_load_madrid_trips.py`: Bike ID. | `GET /.../trips` | `out: get_paginated_trips` | `TrafficLayer` |
| `generation_type`| `04x_scripts`: Type. | `GET /.../trips` | `out: city_has_real_trips` | `TrafficMode` (Selector) |
| `created_at` | System: Creation time. | `GET /.../trips` | `out: get_paginated_trips` | `StatusPage` |

### `paths`
Unique edge sequences between nodes. Deduplicated for shortest-path algorithms.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `050_compute_shortest_paths.py`: PK. | Internal routing logic. | `in: get_or_create_shortest_path` | `TrafficLayer` (On-edge click) |
| `algorithm` | `050_scripts`: 'shortest', etc. | `GET /.../traffic/modes`, `GET /.../traffic/histogram` | `out: get_traffic_modes` | `TrafficMode` (Selector) |
| `city_id` | `050_scripts`: FK to `cities`. | Internal routing. | `in: get_or_create_shortest_path` | `TrafficLayer` |
| `origin_node` | `050_scripts`: Start node FK. | `GET /.../edges/{id}/routes` | `in: get_or_create_shortest_path` | `TrafficLayer` (Heatmap) |
| `dest_node` | `050_scripts`: End node FK. | `GET /.../edges/{id}/routes` | `in: get_or_create_shortest_path` | `TrafficLayer` (Heatmap) |

### `path_edges` / `path_nodes`
Ordered lists of components for a path.
| db column name | Source | API access | db_io functions |
| :--- | :--- | :--- | :--- |
| `path_id` | `050_compute_shortest_paths.py`: FK. | `GET /.../traffic`, `GET /.../edges/{id}/routes` | `in: put_path_edges`, `put_path_nodes` |
| `edge_id` | `050_compute_shortest_paths.py`: FK. | `GET /.../traffic`, `GET /.../edges/{id}/routes` | `in: put_path_edges` |
| `edge_order` | `050_compute_shortest_paths.py`: Order index. | `GET /.../edges/{id}/routes` | `in: put_path_edges` |

### `routes`
Join table linking a `trip` to its computed `path`.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `trip_id` | `050_scripts`: FK. | `GET /.../trips`, `GET /.../traffic/histogram` | `in: link_trip_to_path` | `RouteHistograms` |
| `path_id` | `050_scripts`: FK. | `GET /.../traffic`, `GET /.../traffic/histogram` | `in: link_trip_to_path` | `RouteHistograms` |
| `id` | `050_scripts`: Serial PK. | `GET /.../trips` | `in: link_trip_to_path` | `TrafficLayer` |
| `city_id` | `050_scripts`: FK to `cities`. | `GET /.../trips` | `out: get_paginated_trips` | `StatusPage` |
| `processed` | `050_scripts`: Routing status. | `GET /.../trips` | `out: count_routes` | `StatusPage` |
| `created_at` | System: Creation timestamp. | `GET /.../trips` | `out: get_paginated_trips` | `StatusPage` |

---

## 3. Bike-share Operations
Data related to bicycle sharing systems, station status, and availability.

### `stations`
Metadata for bike-share docking stations.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `station_id` | `030_load_stations.py`: ID. | `GET /.../stations`, `GET /.../reach` | `in: upsert_stations` | `StationsLayer` (Popups) |
| `city_id` | `030_load_stations.py`: FK. | `GET /.../stations`, `GET /status` | `out: get_paginated_stations` | `StatusPage`, `useStationsStats` |
| `lat`, `lon` | `030_load_stations.py`: Location. | `GET /.../stations`, `GET /.../reach` | `out: get_station_monthly_flow` | `StationsLayer` (Markers) |
| `merged_into_id` | `030_load_stations.py`: Deduplication FK. | `GET /.../stations` | `out: get_nearby_unmerged_station` | `StationsLayer` |
| `id` | `030_load_stations.py`: Serial PK. | `GET /.../stations` | `out: get_paginated_stations` | `StationsLayer` |
| `citybikes_network_id`| `030_load_stations.py`: Network ID.| `GET /.../stations`, `GET /cities` | `out: get_paginated_stations` | `CityCard`, `StationsLayer` |
| `name` | `030_load_stations.py`: Name. | `GET /.../stations` | `out: get_paginated_stations` | `StationsLayer` (Labels) |
| `geom` | `030_load_stations.py`: Point. | `GET /.../stations` | `in: upsert_stations` | (Spatial clustering) |
| `extra` | `030_load_stations.py`: JSONB. | `GET /.../stations` | `out: get_paginated_stations` | `StationsLayer` (Details) |
| `first_seen` | `030_load_stations.py`: Discovery. | `GET /.../stations` | `out: get_paginated_stations` | `StatusPage` |
| `last_seen` | `030_load_stations.py`: Last active. | `GET /.../stations` | `out: get_paginated_stations` | `StatusPage` |
| `reach_coverage` | `032_calculate_reach.py`: % reachable. | `GET /.../stations/{id}/reach`| `in: update_station_reach_coverage` | `StationsLayer` (Reach analysis) |
| `building_count` | `032_calculate_reach.py`: Count. | `GET /.../stations/building-coverage` | `out: get_avg_station_building_count` | `useStationsStats` |

### `station_readings`
Historical time-series of bike availability.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `observed_at` | `030_load_stations.py`: Timestamp. | `GET /.../hourly-availability`, `GET /status` | `in: insert_station_readings` | `StationsLayer` (Popups) |
| `available_bikes` | `030_load_stations.py`: Count. | `GET /.../hourly-availability`, `GET /cities`, `GET /status` | `out: get_station_hourly_availability` | `StationsLayer`, `CityCard` |
| `citybikes_network_id`| `030_load_stations.py`: Network ID.| `GET /.../hourly-availability`| `in: insert_station_readings` | `StationsLayer` |
| `station_id` | `030_load_stations.py`: Station ID. | `GET /.../hourly-availability`| `in: insert_station_readings` | `StationsLayer` |
| `empty_slots` | `030_load_stations.py`: Slots. | `GET /.../hourly-availability`| `out: get_station_hourly_availability` | `StationsLayer` (Popups) |
| `city_id` | `030_load_stations.py`: FK to `cities`. | `GET /.../hourly-availability`, `GET /status` | `out: get_station_hourly_availability` | `StatusPage` |
| `extra` | `030_load_stations.py`: JSONB metadata. | `GET /.../hourly-availability`| `in: insert_station_readings` | `StationsLayer` |

### `station_monthly`
Monthly aggregated statistics per station (flows and downtime).
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `estimated_trips` | `031_scripts`: Skellam est. | `GET /.../stats`, `GET /.../stations/monthly` | `in: upsert_station_monthly` | `StationMonthlyChart` |
| `actual_trips` | `040_scripts`: True count. | `GET /.../stats`, `GET /.../stations/monthly` | `in: upsert_station_actual_trips` | `StationMonthlyChart` |
| `downtime_minutes`| `031_scripts`: Empty/Full mins. | `GET /cities/{id}/stats` | `out: get_station_monthly_agg` | `useStationsStats` |
| `city_id` | `031_scripts`: FK to `cities`. | `GET /.../stations/monthly` | `out: get_station_monthly_agg` | `StationMonthlyChart` |
| `citybikes_network_id`| `031_scripts`: Network ID.| `GET /.../stations/monthly` | `out: get_station_monthly_agg` | `StationMonthlyChart` |
| `station_id` | `031_scripts`: Station ID. | `GET /.../stations/monthly` | `out: get_station_monthly_agg` | `StationMonthlyChart` |
| `metric_month` | `031_scripts`: Aggregate month. | `GET /.../stations/monthly` | `out: get_station_monthly_agg` | `StationMonthlyChart` |
| `estimated_inbound` | `031_calculate_traffic.py`: Est. arrivals. | `GET /cities/{id}/stats` | `out: get_station_monthly_flow` |
| `estimated_outbound` | `031_calculate_traffic.py`: Est. departures. | `GET /cities/{id}/stats` | `out: get_station_monthly_flow` |

---

## 4. Analytics & Metrics
High-level summaries and traffic estimations for dashboards.

### `city_metrics`
Monthly performance indicators for a city.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `coverage` | `021_scripts`: % buildings. | `GET /.../stats`, `GET /.../infra/stats` | `in: upsert_city_metrics` | `CityCard`, `useInfraStats` |
| `total_kilometers`| `021_scripts`: Lane km. | `GET /.../stats`, `GET /.../infra/stats` | `in: upsert_city_metrics` | `CityCard`, `useInfraStats` |
| `estimated_monthly_trips`| `031_scripts`: City-wide agg. | `GET /cities`, `GET /cities/{id}` | `in: upsert_city_metrics` | `CityCard`, `CityPage` |
| `actual_monthly_trips` | `040_scripts`: Total real. | `GET /cities`, `GET /cities/{id}` | `in: upsert_city_actual_trips` | `CityCard`, `CityPage` |
| `city_id` | `021_scripts`: FK to `cities`. | `GET /cities` | `in: upsert_city_metrics` | `LandingPage`, `ComparePage` |
| `metric_month` | `021_scripts`: Agg month. | `GET /cities` | `in: upsert_city_metrics` | `ComparePage` |
| `total_stations` | `021_scripts`: Active count. | `GET /cities` | `in: upsert_city_metrics` | `CityCard`, `ComparePage` |
| `avg_station_downtime`| `021_scripts`: Mean downtime. | `GET /cities` | `in: upsert_city_metrics` | `ComparePage` |
| `updated_at` | System: Last update. | `GET /cities` | `in: upsert_city_metrics` | `StatusPage` |

### `estimated_trips_per_interval`
Trips estimated for small time intervals (e.g., 10 mins).
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `city_id` | `031_scripts`: FK to `cities`. | `GET /.../cities`, `GET /status` | `in: upsert_estimated_trips_interval` | `StatusPage` |
| `observed_at` | `031_scripts`: Timestamp. | `GET /.../cities` | `out: get_city_details` | `CityPage` (Timeline) |
| `estimated_trips` | `031_scripts`: Count. | `GET /.../cities` | `out: get_city_details` | `CityPage` (Timeline) |

### `edge_traffic`
Aggregated trip counts per road segment per month.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `edge_id` | `031_scripts`: FK. | `GET /.../traffic` | `in: upsert_edge_traffic` | `TrafficLayer` |
| `trip_count` | `031_scripts`: Agg count. | `GET /.../traffic`, `GET /.../traffic/infra-coverage` | `out: get_edge_traffic` | `TrafficLayer`, `TrafficStats` |
| `month` | `031_scripts`: DATE. | `GET /.../traffic`, `GET /.../traffic/infra-coverage` | `out: get_latest_traffic_month` | `TrafficLayer` (Period select) |
| `generation_type`| `031_scripts`: Source. | `GET /.../traffic/modes` | `out: get_traffic_modes` | `TrafficMode` (Selector) |
| `algorithm` | `031_scripts`: Routing. | `GET /.../traffic/modes` | `out: get_traffic_modes` | `TrafficMode` (Selector) |
| `city_id` | `031_scripts`: FK to `cities`. | `GET /.../traffic` | `out: get_edge_traffic` | `useTrafficStats` |

---

## 5. Contextual & Socio-Political
Tables containing electoral, budget, and governance information.

### `historical_mayors`
List of past and present mayors.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `011_scripts`: Mayor name. | `GET /.../mayors`, `GET /.../context` | `in: put_historical_mayors` | `useMayorHistory`, `CityCard` |
| `party` | `011_scripts`: Party. | `GET /.../mayors`, `GET /.../context` | `out: get_historical_mayors` | `useMayorHistory`, `CityCard` |
| `start_date` | `011_scripts`: Term start. | `GET /.../mayors`, `GET /.../context` | `out: get_historical_mayors` | `useMayorHistory` (Timeline) |
| `id` | `011_scripts`: Serial PK. | `GET /.../mayors` | `out: get_historical_mayors` | `useMayorHistory` |
| `city_id` | `011_scripts`: FK to `cities`. | `GET /.../mayors`, `GET /.../context` | `in: put_historical_mayors` | `useMayorHistory` |
| `end_date` | `011_scripts`: Term end. | `GET /.../mayors`, `GET /.../context` | `out: get_historical_mayors` | `useMayorHistory` (Timeline) |

### `city_budgets` / `city_budget_categories`
Annual fiscal data and detailed category breakdowns.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `total_expenses` | `013_scripts`: Expenses. | `GET /.../budgets`, `GET /.../context` | `in: put_city_budgets` | `useCityBudgets`, `CityCard` |
| `category_code` | `013_scripts`: Code. | `GET /.../infra/budget`, `GET /.../context` | `out: get_infra_budget` | `useCityBudgets` (Breakdown) |
| `amount` | `013_scripts`: Amount. | `GET /.../budgets`, `GET /.../context` | `in: put_city_budget_categories` | `useCityBudgets` (Sunburst) |
| `id` | `013_scripts`: Serial PK. | `GET /.../budgets` | `out: get_city_budgets` | `useCityBudgets` |
| `city_id` | `013_scripts`: FK to `cities`. | `GET /.../budgets`, `GET /.../context` | `in: put_city_budgets` | `useCityBudgets` |
| `year` | `013_scripts`: Year. | `GET /.../budgets`, `GET /.../context` | `in: put_city_budgets` | `useCityBudgets` (Year select) |
| `budget_type` | `013_scripts`: Type. | `GET /.../budgets`, `GET /.../context` | `in: put_city_budgets` | `useCityBudgets` |
| `total_income` | `013_scripts`: Income. | `GET /.../budgets` | `in: put_city_budgets` | `useCityBudgets` |
| `public_debt` | `013_scripts`: Debt. | `GET /.../budgets` | `in: put_city_budgets` | `useCityBudgets` |
| `category_name` | `013_scripts`: Name. | `GET /.../budgets`, `GET /.../context` | `in: put_city_budget_categories` | `useCityBudgets` |

### `city_elections` / `city_councilors`
Electoral results and individual councilor records.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `year`, `party` | `012_scripts`: Election context. | `GET /.../mayors`| `in: put_city_elections` | `useMayorHistory` |
| `votes`, `councilors`| `012_scripts`: Vote counts. | `GET /.../mayors`| `out: get_city_elections_data` | `useMayorHistory` |
| `name`, `elected` | `012_scripts`: Individual. | `GET /.../mayors`| `in: put_city_councilors` | `useMayorHistory` |
| `id` | `012_scripts`: Serial PK. | `GET /.../mayors`| `out: get_city_elections_data` | `useMayorHistory` |
| `city_id` | `012_scripts`: FK. | `GET /.../mayors`| `in: put_city_elections` | `useMayorHistory` |

---

## 6. Road Safety
Registers of traffic accidents and participants.

### `accidents`
Geo-located accident events.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `accident_id` | `060_scripts`: External ID. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer`, `StatusPage` |
| `geom` | `060_scripts`: Point. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` (Markers) |
| `injured` / `killed` | `060_scripts`: Counts. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer`, `useAccidentsStats` |
| `vehicles_involved`| `060_scripts`: List.| `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` (Filters) |
| `id` | `060_scripts`: Serial PK. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` |
| `city_id` | `060_scripts`: FK to `cities`. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `StatusPage` |
| `timestamp` | `060_scripts`: Time. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` (Tooltips) |
| `street` | `060_scripts`: Street. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` (Details) |
| `district` | `060_scripts`: District. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` |
| `accident_type` | `060_scripts`: Collision. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` (Filters) |
| `weather` | `060_scripts`: Weather. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` |
| `closest_edge_id` | `060_scripts`: Map-matched. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | (Internal analysis) |
| `total_involved` | `060_scripts`: People. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `AccidentsLayer` |
| `source` | `060_scripts`: Source. | `GET /.../accidents`, `GET /status` | `out: get_accidents_geojson` | `StatusPage` |

### `accident_participants`
Details for each person involved in an accident.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `age_range`, `sex` | `060_scripts`: Demographics. | `GET /.../accidents` | `out: get_accident_participants` | `AccidentsLayer` (Details) |
| `injury_status` | `060_scripts`: Severity. | `GET /.../accidents` | `out: get_accident_participants` | `AccidentsLayer` (Details) |
| `id` | `060_scripts`: Serial PK. | `GET /.../accidents` | `in: put_accident_participants` | `AccidentsLayer` |
| `person_type` | `060_scripts`: Role. | `GET /.../accidents` | `out: get_accident_participants` | `AccidentsLayer` |
| `vehicle_type` | `060_scripts`: Mode. | `GET /.../accidents` | `out: get_accident_participants` | `AccidentsLayer` |
| `injury_code` | `060_scripts`: Code. | `GET /.../accidents` | `out: get_accident_participants` | `AccidentsLayer` |
| `alcohol_positive` | `060_scripts`: BAC. | `GET /.../accidents` | `out: get_accident_participants` | `AccidentsLayer` |
| `drugs_positive` | `060_scripts`: Drugs. | `GET /.../accidents` | `out: get_accident_participants` | `AccidentsLayer` |
| `accident_type` | `060_scripts`: Collision. | `GET /.../accidents` | `out: get_accident_participants` | `AccidentsLayer` |

---

## 7. Operational Metadata
System tables for tracking the data pipeline.

### `ingestion_status`
Tracks the progress and success of various ingestion scripts.
| db column name | Source | API access | db_io functions | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- |
| `process_name` | `run_ingestion.sh`: Script name. | `GET /status` | `out: get_ingestion_status` | `StatusPage` |
| `status` | `run_ingestion.sh`: Status. | `GET /status` | `in: upsert_ingestion_status` | `StatusPage` |
| `updated_at` | System: Timestamp. | `GET /status` | `in: upsert_ingestion_status` | `StatusPage` |
| `details` | `run_ingestion.sh`: Logs/Errors. | `GET /status` | `in: upsert_ingestion_status` | `StatusPage` |
| `id` | System: Serial PK. | `GET /status` | `out: get_ingestion_status` | `StatusPage` |
| `city_id` | `run_ingestion.sh`: FK. | `GET /status` | `out: get_ingestion_status` | `StatusPage` |
| `time_period` | `run_ingestion.sh`: Context. | `GET /status` | `out: get_ingestion_status` | `StatusPage` |
