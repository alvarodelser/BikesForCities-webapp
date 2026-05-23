-- Migration 004: Add composite index on edge_traffic for fast 4-column filter lookups.
--
-- Before this index every query filtering by (city_id, generation_type, algorithm, month)
-- fell back to a sequential scan over the full table (~72k rows per city), which caused
-- concurrent API requests to exceed the nginx proxy_read_timeout.
--
CREATE INDEX IF NOT EXISTS idx_edge_traffic_lookup
    ON edge_traffic(city_id, generation_type, algorithm, month);
