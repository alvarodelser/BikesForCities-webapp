-- Migration 015: Add missing routes and trips indexes for routing performance.
--
-- idx_routes_trip_id was defined in schema.sql but never added via migration,
-- so existing DBs lack it. Without it, the NOT EXISTS subquery in
-- get_unrouted_trip_groups does a full seq-scan of routes per trip.
--
-- idx_trips_city_od supports the GROUP BY (city_id, origin_node, dest_node)
-- used in routing batch queries.

CREATE INDEX IF NOT EXISTS idx_routes_trip_id ON routes(trip_id);
CREATE INDEX IF NOT EXISTS idx_routes_path_id ON routes(path_id);
CREATE INDEX IF NOT EXISTS idx_trips_city_od  ON trips(city_id, origin_node, dest_node);
