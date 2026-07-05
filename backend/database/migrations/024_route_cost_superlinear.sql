-- Migration 024: superlinear route_cost for safe-path routing.
--
-- Replaces the log-based danger term from migration 010 with a linear-in-length
-- term, making the danger contribution quadratic in edge length. A short hop on
-- a dangerous road stays cheap; a long continuous run becomes prohibitive.
--
-- route_cost = length * (1 + peligrosidad * length / 7200)
--   beta = 1, C = 7200 (= 50 * 144), fitted to two anchors on a
--   primary 4-lane 50km/h road (peligrosidad = 36):
--       100m -> 150  (feels 1.5x, kept from migration 010 calibration)
--       200m -> 400  (feels 2.0x, "won't ride a highway past ~200m")
--   Safe edges (peligrosidad = 0) cost exactly their length.
--
-- peligrosidad_score is unchanged. This CREATE OR REPLACE supersedes the
-- route_cost defined in migration 010.
CREATE OR REPLACE FUNCTION route_cost(
    p_length         DOUBLE PRECISION,
    p_peligrosidad   INTEGER
) RETURNS DOUBLE PRECISION
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
    SELECT p_length * (
        1 + COALESCE(p_peligrosidad, 0) * p_length / 7200.0
    );
$$;
