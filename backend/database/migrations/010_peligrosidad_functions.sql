-- Migration 010: peligrosidad (danger) score and route_cost SQL functions.
--
-- Both functions are IMMUTABLE so Postgres can inline them inside routing
-- queries without re-executing per row. They operate purely on existing
-- edge columns + the new bike_infra column.

-- ─────────────────────────────────────────────────────────────────────────
-- peligrosidad_score
--   Returns integer in roughly [0, 60]. Higher = more dangerous for cycling.
--   Composition:
--     base = highway-class score, lowered by bike_infra if Madrid gave us
--            a safer classification (LEAST), then raised to 20 floor if
--            the edge is a bridge or tunnel (GREATEST).
--     + speed penalty from maxspeed[1] (urban OSM convention: first value)
--     + lanes penalty from lanes[1]
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION peligrosidad_score(
    p_highway   TEXT,
    p_bike_infra TEXT,
    p_maxspeed  INTEGER[],
    p_lanes     INTEGER[],
    p_tunnel    BOOLEAN,
    p_bridge    BOOLEAN
) RETURNS INTEGER
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
    SELECT
        -- Base (highway/bike_infra) with bridge/tunnel floor at 20
        GREATEST(
            CASE WHEN p_tunnel OR p_bridge THEN 20 ELSE 0 END,
            -- LEAST(bike_infra_score, highway_score)
            LEAST(
                CASE p_bike_infra
                    WHEN 'cycleway'  THEN 0
                    WHEN 'secondary' THEN 6
                    ELSE 999  -- effectively infinity → highway wins
                END,
                CASE p_highway
                    WHEN 'cycleway'      THEN 0
                    WHEN 'living_street' THEN 1
                    WHEN 'residential'   THEN 3
                    WHEN 'tertiary'      THEN 3
                    WHEN 'secondary'     THEN 6
                    WHEN 'primary'       THEN 12
                    WHEN 'trunk'         THEN 20
                    ELSE 6   -- conservative default for unknown/NULL
                END
            )
        )
        -- Speed penalty
        + CASE
            WHEN p_maxspeed IS NULL OR array_length(p_maxspeed, 1) IS NULL
                                                   THEN 0
            WHEN p_maxspeed[1] <= 20               THEN 0
            WHEN p_maxspeed[1] <= 30               THEN 2
            WHEN p_maxspeed[1] <= 40               THEN 4
            WHEN p_maxspeed[1] <= 50               THEN 8
            ELSE                                        16
        END
        -- Lanes penalty
        + CASE
            WHEN p_lanes IS NULL OR array_length(p_lanes, 1) IS NULL
                                       THEN 0
            WHEN p_lanes[1] <= 1       THEN 0
            WHEN p_lanes[1] = 2        THEN 4
            WHEN p_lanes[1] = 3        THEN 8
            ELSE                            16
        END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- route_cost
--   Cost of traversing a `length`-meter edge with given peligrosidad.
--   Calibration anchors (set K = 144):
--       100m cycleway      → 100
--       100m primary 4-lane @50  → ~150
--       500m primary 4-lane @50  → ~850
--   GREATEST(length,1) prevents log10(0) for sub-1m edges at intersections.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION route_cost(
    p_length         DOUBLE PRECISION,
    p_peligrosidad   INTEGER
) RETURNS DOUBLE PRECISION
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
    SELECT p_length * (
        1 + COALESCE(p_peligrosidad, 0) * LOG(GREATEST(p_length, 1)) / 144.0
    );
$$;
