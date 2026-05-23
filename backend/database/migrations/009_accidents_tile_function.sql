-- Migration 009: Martin tile function for accidents.
--
-- Serves accidents as MVT tiles so the map only fetches the visible viewport
-- instead of the full city payload. Severity is computed at tile time from
-- accident_participants using the rank-aware CASE that picks the worst victim
-- (Madrid injury codes are NOT ordinal — code 14 'uninjured' is numerically
-- greater than code 4 'fatal').
--
-- Query params (passed via Martin's query_params JSON):
--   city_id        — required; numeric id of the city to render
--   cyclists_only  — optional; 'true' restricts to bike_vmu accidents

CREATE OR REPLACE FUNCTION accidents_tile(z integer, x integer, y integer, query_params json)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    target_city_id INTEGER := NULLIF(query_params->>'city_id', '')::INTEGER;
    cyclists_only  BOOLEAN := COALESCE((query_params->>'cyclists_only')::BOOLEAN, FALSE);
    tile_3857      GEOMETRY := ST_TileEnvelope(z, x, y);
    tile_4326      GEOMETRY := ST_Transform(tile_3857, 4326);
    tile           BYTEA;
BEGIN
    IF target_city_id IS NULL THEN
        RETURN ''::BYTEA;
    END IF;

    -- ST_AsMVT's feature_id_column expects a numeric id; we expose accident_id
    -- (TEXT) as a property and let the client promoteId from that property.
    SELECT ST_AsMVT(q, 'accidents', 4096, 'geom')
    INTO tile
    FROM (
        SELECT
            a.accident_id,
            a.severity,
            ST_AsMVTGeom(ST_Transform(a.geom, 3857), tile_3857, 4096, 0, true) AS geom
        FROM (
            SELECT
                a.id,
                a.accident_id,
                a.killed,
                a.geom,
                CASE
                    WHEN a.killed > 0 THEN 'fatal'
                    ELSE (
                        CASE MIN(
                            CASE ap.injury_code
                                WHEN 4  THEN 1
                                WHEN 3  THEN 2
                                WHEN 1  THEN 3
                                WHEN 2  THEN 3
                                WHEN 5  THEN 3
                                WHEN 6  THEN 3
                                WHEN 7  THEN 3
                                WHEN 14 THEN 4
                                ELSE 5
                            END
                        )
                            WHEN 1 THEN 'fatal'
                            WHEN 2 THEN 'serious'
                            WHEN 3 THEN 'minor'
                            WHEN 4 THEN 'uninjured'
                            ELSE 'uninjured'
                        END
                    )
                END AS severity
            FROM accidents a
            LEFT JOIN accident_participants ap ON ap.accident_db_id = a.id
            WHERE a.city_id = target_city_id
              AND a.geom IS NOT NULL
              AND a.geom && tile_4326
              AND (NOT cyclists_only OR 'bike_vmu' = ANY(a.vehicles_involved))
            GROUP BY a.id
        ) a
        WHERE ST_AsMVTGeom(ST_Transform(a.geom, 3857), tile_3857, 4096, 0, true) IS NOT NULL
    ) q;

    RETURN COALESCE(tile, ''::BYTEA);
END;
$$;
