-- Migration 006: Indexes to speed up edge-routes queries.
--
-- The routes endpoint (get_edge_route_traces / get_edge_route_od) starts from
-- path_edges(edge_id), joins to routes by path_id, then filters routes by
-- city_id. Without a composite index the route join falls back to a seq-scan
-- over the full routes table.
--
-- idx_routes_path_city  covers the join ON r.path_id = pe2.path_id AND r.city_id = ?
-- idx_path_edges_path   covers the reverse join ON pe.path_id = m.path_id in
--                       the outer geometry collection step.

CREATE INDEX IF NOT EXISTS idx_routes_path_city
    ON routes(path_id, city_id);

CREATE INDEX IF NOT EXISTS idx_path_edges_path_id
    ON path_edges(path_id);
