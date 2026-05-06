-- Migration 002: schema cleanup
-- Removes unused columns, resolves duplicate metrics, moves gcc stats to city_metrics.
-- No data migration required — all affected metrics are re-derived at ingestion time.

-- ── 1. Drop unused columns from cities ───────────────────────────────────────
-- angle: was used for rotated study-area bounding box; all study areas now axis-aligned.
ALTER TABLE cities DROP COLUMN IF EXISTS angle;

-- Add pre-computed geographic bounds (populated by 020_load_osm.py after node ingestion)
-- Replaces the MIN/MAX(lat/lon) subquery that fired on every /cities call.
ALTER TABLE cities ADD COLUMN IF NOT EXISTS bounds_min_lat DOUBLE PRECISION;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS bounds_max_lat DOUBLE PRECISION;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS bounds_min_lon DOUBLE PRECISION;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS bounds_max_lon DOUBLE PRECISION;

-- ── 2. Drop unused feature flags from city_modes ──────────────────────────────
-- topography / intersections / forum: unimplemented mode flags; no data or UI depends on them.
ALTER TABLE city_modes DROP COLUMN IF EXISTS topography;
ALTER TABLE city_modes DROP COLUMN IF EXISTS intersections;
ALTER TABLE city_modes DROP COLUMN IF EXISTS forum;

-- ── 3. Move gcc stats from city_modes → city_metrics ─────────────────────────
-- city_modes.total_cycling_km is identical to city_metrics.total_kilometers (already present).
-- gcc_fraction, gcc_km, n_components are now written by 020_load_osm.py into city_metrics.
ALTER TABLE city_modes DROP COLUMN IF EXISTS gcc_fraction;
ALTER TABLE city_modes DROP COLUMN IF EXISTS gcc_km;
ALTER TABLE city_modes DROP COLUMN IF EXISTS total_cycling_km;
ALTER TABLE city_modes DROP COLUMN IF EXISTS n_components;

ALTER TABLE city_metrics ADD COLUMN IF NOT EXISTS gcc_fraction DOUBLE PRECISION;
ALTER TABLE city_metrics ADD COLUMN IF NOT EXISTS gcc_km       DOUBLE PRECISION;
ALTER TABLE city_metrics ADD COLUMN IF NOT EXISTS n_components  INTEGER;

-- ── 4. Add bicycles_count to city_metrics ────────────────────────────────────
-- Replaces the PERCENTILE_CONT subquery on station_readings fired on every /cities call.
-- Populated by 031_calculate_traffic.py per metric month.
ALTER TABLE city_metrics ADD COLUMN IF NOT EXISTS bicycles_count INTEGER;

-- ── Summary of remaining duplicates resolved at read time ────────────────────
-- city_metrics.total_kilometers     → wins over (dropped) city_modes.total_cycling_km
-- city_metrics.coverage             → wins over get_building_coverage_fraction() at query time
-- city_metrics.estimated_monthly_trips → /cities endpoint now reads this instead of
--                                       summing estimated_trips_per_interval at runtime
-- city_metrics.total_stations       → /cities endpoint now reads this instead of COUNT(stations)
-- city_metrics.bicycles_count       → /cities endpoint now reads this instead of PERCENTILE subquery
-- cities.bounds_*                   → /cities endpoint now reads these instead of MIN/MAX(nodes)
