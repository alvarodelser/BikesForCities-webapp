-- Migration 016: extend accidents_tile to support year range filtering.
--
-- Query params (passed via Martin's query_params JSON):
--   city_id        — required; numeric id of the city to render
--   cyclists_only  — optional; 'true' restricts to bike_vmu accidents
--   year_from      — optional; integer, lower bound (inclusive)
--   year_to        — optional; integer, upper bound (inclusive)
--
-- Replaces the single `year` param from migration 011.

CREATE OR REPLACE FUNCTION accidents_tile(z integer, x integer, y integer, query_params json)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    target_city_id  INTEGER := NULLIF(query_params->>'city_id', '')::INTEGER;
    cyclists_only   BOOLEAN := COALESCE((query_params->>'cyclists_only')::BOOLEAN, FALSE);
    target_year_from INTEGER := NULLIF(query_params->>'year_from', '')::INTEGER;
    target_year_to   INTEGER := NULLIF(query_params->>'year_to',   '')::INTEGER;
    tile_3857       GEOMETRY := ST_TileEnvelope(z, x, y);
    tile_4326       GEOMETRY := ST_Transform(tile_3857, 4326);
    tile            BYTEA;
BEGIN
    IF target_city_id IS NULL THEN
        RETURN ''::BYTEA;
    END IF;

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
              AND (target_year_from IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INTEGER >= target_year_from)
              AND (target_year_to   IS NULL OR EXTRACT(YEAR FROM a.timestamp)::INTEGER <= target_year_to)
            GROUP BY a.id
        ) a
        WHERE ST_AsMVTGeom(ST_Transform(a.geom, 3857), tile_3857, 4096, 0, true) IS NOT NULL
    ) q;

    RETURN COALESCE(tile, ''::BYTEA);
END;
$$;
