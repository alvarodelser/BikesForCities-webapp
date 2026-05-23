-- Migration 014: unique index for safest-path deduplication.
-- Mirrors paths_shortest_uq so that get_or_create_safest_path can use
-- ON CONFLICT to deduplicate without a race condition.
CREATE UNIQUE INDEX IF NOT EXISTS paths_safest_uq
    ON paths(city_id, origin_node, dest_node)
    WHERE algorithm = 'safest';
