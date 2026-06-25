-- Migration 020: Fix SRID mismatch re-introduced in migration 017.
--
-- Migration 017 added month-range aggregation but re-introduced the bug fixed
-- in migration 005: ST_TileEnvelope returns SRID 3857 (Web Mercator), while
-- edges.geom is SRID 4326.  Using them without transformation in the spatial
-- filter and in ST_AsMVTGeom caused every tile to return 204 No Content.
--
-- Fix (same as 005): pre-compute tile_3857 and tile_4326, use tile_4326 for
-- the bbox filter so the GIST index on edges.geom is hit, then transform each
-- edge to 3857 inside a subquery before passing to ST_AsMVTGeom.

CREATE OR REPLACE FUNCTION edges_with_traffic(z integer, x integer, y integer, query_params json)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    gen_type    TEXT     := query_params->>'generation_type';
    algo        TEXT     := query_params->>'algorithm';
    month_val   DATE     := NULLIF(query_params->>'month', '')::DATE;
    month_from  DATE     := NULLIF(query_params->>'month_from', '')::DATE;
    tile_3857   GEOMETRY := ST_TileEnvelope(z, x, y);
    tile_4326   GEOMETRY := ST_Transform(tile_3857, 4326);
    tile        BYTEA;
BEGIN
    IF month_from IS NOT NULL AND month_val IS NOT NULL THEN
        -- Range mode: aggregate SUM(trip_count) across [month_from, month_val]
        SELECT ST_AsMVT(q, 'edges', 4096, 'geom')
        INTO tile
        FROM (
            SELECT
                src.id, src.city_id, src.name, src.highway, src.length, src.trip_count,
                ST_AsMVTGeom(src.geom_3857, tile_3857, 4096, 0, true) AS geom
            FROM (
                SELECT
                    e.id, e.city_id, e.name, e.highway, e.length,
                    COALESCE(agg.trip_count, 0) AS trip_count,
                    ST_Transform(e.geom, 3857)  AS geom_3857
                FROM edges e
                LEFT JOIN (
                    SELECT edge_id, SUM(trip_count) AS trip_count
                    FROM edge_traffic
                    WHERE generation_type = gen_type
                      AND algorithm       = algo
                      AND month          >= month_from
                      AND month          <= month_val
                    GROUP BY edge_id
                ) agg ON agg.edge_id = e.id
                WHERE e.geom && tile_4326
            ) src
            WHERE ST_AsMVTGeom(src.geom_3857, tile_3857, 4096, 0, true) IS NOT NULL
        ) q;
    ELSE
        -- Single-month mode
        SELECT ST_AsMVT(q, 'edges', 4096, 'geom')
        INTO tile
        FROM (
            SELECT
                src.id, src.city_id, src.name, src.highway, src.length, src.trip_count,
                ST_AsMVTGeom(src.geom_3857, tile_3857, 4096, 0, true) AS geom
            FROM (
                SELECT
                    e.id, e.city_id, e.name, e.highway, e.length,
                    COALESCE(et.trip_count, 0) AS trip_count,
                    ST_Transform(e.geom, 3857) AS geom_3857
                FROM edges e
                LEFT JOIN edge_traffic et
                       ON et.edge_id         = e.id
                      AND et.generation_type  = gen_type
                      AND et.algorithm        = algo
                      AND et.month            = month_val
                WHERE e.geom && tile_4326
            ) src
            WHERE ST_AsMVTGeom(src.geom_3857, tile_3857, 4096, 0, true) IS NOT NULL
        ) q;
    END IF;

    RETURN COALESCE(tile, ''::BYTEA);
END;
$$;
