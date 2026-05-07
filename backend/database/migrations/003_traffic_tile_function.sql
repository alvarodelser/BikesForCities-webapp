-- Migration 003: Add tile function for edges with traffic data baked in.
--
-- Martin "function sources" call a PL/pgSQL function with (z, x, y, query_params JSONB)
-- and expect bytea (MVT) in return.  We embed trip_count from edge_traffic directly
-- into the tile so the frontend never needs a separate /traffic REST call for coloring.
--
-- Parameters passed via query_params:
--   generation_type TEXT  (e.g. 'real', 'station_based')
--   algorithm       TEXT  (e.g. 'map_matched', 'shortest')
--   month           TEXT  (YYYY-MM-DD, i.e. first day of the target month)
--
-- If any parameter is omitted/null the function falls back to 0 for trip_count,
-- so the layer still renders without traffic data (grey state).

CREATE OR REPLACE FUNCTION edges_with_traffic(z integer, x integer, y integer, query_params json)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    gen_type  TEXT := query_params->>'generation_type';
    algo      TEXT := query_params->>'algorithm';
    month_val DATE := (query_params->>'month')::DATE;
    tile      BYTEA;
BEGIN
    SELECT ST_AsMVT(q, 'edges', 4096, 'geom')
    INTO tile
    FROM (
        SELECT
            e.id,
            e.city_id,
            e.name,
            e.highway,
            e.length,
            COALESCE(et.trip_count, 0)                        AS trip_count,
            ST_AsMVTGeom(
                e.geom,
                ST_TileEnvelope(z, x, y),
                4096, 0, true
            )                                                 AS geom
        FROM edges e
        LEFT JOIN edge_traffic et
               ON et.edge_id        = e.id
              AND et.generation_type = gen_type
              AND et.algorithm       = algo
              AND et.month           = month_val
        WHERE e.geom && ST_TileEnvelope(z, x, y)
          AND ST_AsMVTGeom(e.geom, ST_TileEnvelope(z, x, y), 4096, 0, true) IS NOT NULL
    ) q;

    RETURN COALESCE(tile, ''::BYTEA);
END;
$$;

-- Grant read access to the DB user that Martin connects as
-- (replace 'your_db_user' with the actual user if needed – Martin uses DATABASE_URL)
-- GRANT EXECUTE ON FUNCTION edges_with_traffic(integer, integer, integer, json) TO your_db_user;
