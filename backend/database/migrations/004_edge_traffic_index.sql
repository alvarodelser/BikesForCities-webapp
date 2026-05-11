-- Migration 004: Add composite index on edge_traffic for fast 4-column filter lookups.
--
-- Before this index every query filtering by (city_id, generation_type, algorithm, month)
-- fell back to a sequential scan over the full table (~72k rows per city), which caused
-- concurrent API requests to exceed the nginx proxy_read_timeout.
--
-- Use CONCURRENTLY so the index build does not lock the table in production.
-- (Remove CONCURRENTLY if running inside a transaction block / migration runner that
-- wraps everything in BEGIN…COMMIT, since CONCURRENTLY cannot run inside a transaction.)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edge_traffic_lookup
    ON edge_traffic(city_id, generation_type, algorithm, month);
