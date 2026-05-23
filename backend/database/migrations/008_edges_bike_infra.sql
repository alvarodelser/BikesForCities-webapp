-- Migration 008: Add Madrid bike-infrastructure classification to edges.
--
-- bike_infra is a city-specific enrichment column. It is populated ONLY for
-- edges that spatially match Madrid's official "vías ciclistas" shapefile.
-- Values are mapped onto OSM-like terminology so the peligrosidad function
-- can treat them uniformly:
--   'cycleway'  = VÍA EXCLUSIVA BICI or ANILLO VERDE CICLISTA
--   'secondary' = VÍA USO COMPARTIDO or VÍA PREFERENTE BICI
-- NULL means: no Madrid data for this edge (or non-Madrid city).
--
-- This column NEVER overwrites OSM's `highway` tag. Peligrosidad takes the
-- LEAST (safer) of the two when both are present.

ALTER TABLE edges
    ADD COLUMN IF NOT EXISTS bike_infra TEXT;

CREATE INDEX IF NOT EXISTS idx_edges_bike_infra
    ON edges (bike_infra)
    WHERE bike_infra IS NOT NULL;
