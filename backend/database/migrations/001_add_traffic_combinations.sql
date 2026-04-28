-- Add traffic_combinations JSONB column to city_modes.
-- Stores the list of {generation_type, algorithm} combos that have sufficient
-- edge_traffic data (>= TRAFFIC_MIN_EDGES distinct edges) for a city.
-- The boolean traffic column remains as a fast availability flag.
ALTER TABLE city_modes
    ADD COLUMN IF NOT EXISTS traffic_combinations JSONB DEFAULT '[]';
