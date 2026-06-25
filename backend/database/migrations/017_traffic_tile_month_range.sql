-- Migration 017: extend edges_with_traffic tile function to support month ranges.
-- When query_params contains both 'month' (end) and 'month_from' (start), the
-- function aggregates SUM(trip_count) across the range instead of a single month.
-- Single-month behaviour is preserved when 'month_from' is absent.

CREATE OR REPLACE FUNCTION edges_with_traffic(z integer, x integer, y integer, query_params json)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    gen_type    TEXT := query_params->>'generation_type';
    algo        TEXT := query_params->>'algorithm';
    month_val   DATE := NULLIF(query_params->>'month', '')::DATE;
    month_from  DATE := NULLIF(query_params->>'month_from', '')::DATE;
    tile        BYTEA;
BEGIN
    IF month_from IS NOT NULL AND month_val IS NOT NULL THEN
        -- Range mode: aggregate SUM(trip_count) across [month_from, month_val]
        SELECT ST_AsMVT(q, 'edges', 4096, 'geom')
        INTO tile
        FROM (
            SELECT
                e.id,
                e.city_id,
                e.name,
                e.highway,
                e.length,
                COALESCE(agg.trip_count, 0) AS trip_count,
                ST_AsMVTGeom(
                    e.geom,
                    ST_TileEnvelope(z, x, y),
                    4096, 0, true
                ) AS geom
            FROM edges e
            LEFT JOIN (
                SELECT edge_id, SUM(trip_count) AS trip_count
                FROM edge_traffic
                WHERE generation_type = gen_type
                  AND algorithm       = algo
                  AND month >= month_from
                  AND month <= month_val
                GROUP BY edge_id
            ) agg ON agg.edge_id = e.id
            WHERE e.geom && ST_TileEnvelope(z, x, y)
              AND ST_AsMVTGeom(e.geom, ST_TileEnvelope(z, x, y), 4096, 0, true) IS NOT NULL
        ) q;
    ELSE
        -- Single-month mode (original behaviour)
        SELECT ST_AsMVT(q, 'edges', 4096, 'geom')
        INTO tile
        FROM (
            SELECT
                e.id,
                e.city_id,
                e.name,
                e.highway,
                e.length,
                COALESCE(et.trip_count, 0) AS trip_count,
                ST_AsMVTGeom(
                    e.geom,
                    ST_TileEnvelope(z, x, y),
                    4096, 0, true
                ) AS geom
            FROM edges e
            LEFT JOIN edge_traffic et
                   ON et.edge_id        = e.id
                  AND et.generation_type = gen_type
                  AND et.algorithm       = algo
                  AND et.month           = month_val
            WHERE e.geom && ST_TileEnvelope(z, x, y)
              AND ST_AsMVTGeom(e.geom, ST_TileEnvelope(z, x, y), 4096, 0, true) IS NOT NULL
        ) q;
    END IF;

    RETURN COALESCE(tile, ''::BYTEA);
END;
$$;
