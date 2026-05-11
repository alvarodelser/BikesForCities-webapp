-- Migration 005: Fix SRID mismatch in edges_with_traffic tile function.
--
-- ST_TileEnvelope returns SRID 3857 (Web Mercator, metres).
-- edges.geom is SRID 4326 (WGS-84, degrees).
-- The original WHERE e.geom && ST_TileEnvelope(...) compared raw coordinate
-- values across incompatible systems, so the bounding-box filter matched
-- nothing and every tile returned 204 No Content.
--
-- Fix: transform the tile envelope to 4326 for the spatial filter so the
-- existing idx_edges_geom GIST index is used, then transform each matching
-- edge to 3857 for ST_AsMVTGeom which expects Web Mercator input.

CREATE OR REPLACE FUNCTION edges_with_traffic(z integer, x integer, y integer, query_params json)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    gen_type       TEXT     := query_params->>'generation_type';
    algo           TEXT     := query_params->>'algorithm';
    month_val      DATE     := (query_params->>'month')::DATE;
    tile_3857      GEOMETRY := ST_TileEnvelope(z, x, y);
    tile_4326      GEOMETRY := ST_Transform(tile_3857, 4326);
    tile           BYTEA;
BEGIN
    SELECT ST_AsMVT(q, 'edges', 4096, 'geom')
    INTO tile
    FROM (
        SELECT
            src.id,
            src.city_id,
            src.name,
            src.highway,
            src.length,
            src.trip_count,
            ST_AsMVTGeom(src.geom_3857, tile_3857, 4096, 0, true) AS geom
        FROM (
            SELECT
                e.id,
                e.city_id,
                e.name,
                e.highway,
                e.length,
                COALESCE(et.trip_count, 0)    AS trip_count,
                ST_Transform(e.geom, 3857)    AS geom_3857
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

    RETURN COALESCE(tile, ''::BYTEA);
END;
$$;
