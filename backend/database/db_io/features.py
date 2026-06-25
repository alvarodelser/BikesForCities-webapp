"""
features.py – CRUD for OSM features table.
"""
from typing import List, Optional, Tuple
from psycopg2.extras import RealDictCursor


def put_features(conn, city_id: int, features_data: List[Tuple]):
    """Replace all features for a city with a fresh set.

    Deletes existing features first to avoid accumulating duplicates
    across repeated ingestion runs. Tuple layout: (feature_type, geometry_wkt, tags_json)
    """
    with conn.cursor() as cur:
        cur.execute("DELETE FROM features WHERE city_id = %s", (city_id,))
        cur.executemany(
            """
            INSERT INTO features (city_id, feature_type, geometry, tags)
            VALUES (%s, %s, ST_GeomFromText(%s, 4326), %s)
            """,
            [(city_id, ft, geom, tags) for ft, geom, tags in features_data],
        )


def get_features(
    conn, city_id: int, feature_type: Optional[str] = None
) -> List[Tuple]:
    """Return features by city, optionally filtered by type.
    Returns (id, feature_type, geometry_wkt, tags).
    """
    with conn.cursor() as cur:
        if feature_type:
            cur.execute(
                """
                SELECT id, feature_type, ST_AsText(geometry), tags
                FROM features WHERE city_id = %s AND feature_type = %s
                """,
                (city_id, feature_type),
            )
        else:
            cur.execute(
                "SELECT id, feature_type, ST_AsText(geometry), tags FROM features WHERE city_id = %s",
                (city_id,),
            )
        return cur.fetchall()


def get_building_coverage_fraction(conn, city_id: int) -> Optional[float]:
    """Return fraction of buildings within 150 m of a bike path (0–1), restricted to
    the 10×10 km study area centred on the city.

    Uses ±5000/cos(lat) Web Mercator units so the envelope is exactly ±5 km on the
    ground at the city's latitude, matching the ingestion metric in calculate_osm_metrics.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            WITH center AS (
                SELECT
                    center_lat,
                    ST_Transform(ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326), 3857) AS pt
                FROM cities WHERE id = %s
            ),
            study_area AS (
                SELECT ST_Transform(
                    ST_MakeEnvelope(
                        ST_X(pt) - 5000.0 / cos(radians(center_lat)),
                        ST_Y(pt) - 5000.0 / cos(radians(center_lat)),
                        ST_X(pt) + 5000.0 / cos(radians(center_lat)),
                        ST_Y(pt) + 5000.0 / cos(radians(center_lat)),
                        3857
                    ),
                    4326
                ) AS geom
                FROM center
            )
            SELECT
                SUM(CASE WHEN f.feature_type = 'bike_path_buildings' THEN 1 ELSE 0 END)::float,
                COUNT(*)::float
            FROM features f
            JOIN study_area sa ON ST_Intersects(f.geometry, sa.geom)
            WHERE f.city_id = %s AND f.feature_type IN ('buildings', 'bike_path_buildings')
            """,
            (city_id, city_id),
        )
        row = cur.fetchone()
    if not row or not row[1]:
        return None
    return round(row[0] / row[1], 4)


def count_features(conn, city_id: int, feature_type: Optional[str] = None) -> int:
    with conn.cursor() as cur:
        if feature_type:
            cur.execute(
                "SELECT COUNT(*) FROM features WHERE city_id = %s AND feature_type = %s",
                (city_id, feature_type),
            )
        else:
            cur.execute("SELECT COUNT(*) FROM features WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]


def get_paginated_features(conn, city_id: int, feature_type: Optional[str] = None,
                           bbox: Optional[Tuple[float, float, float, float]] = None,
                           limit: int = 100, offset: int = 0) -> Tuple[list, int]:
    """Retrieve paginated features for API with optional filters."""
    conditions = ["city_id = %s"]
    params = [city_id]
    
    if feature_type:
        conditions.append("feature_type = %s")
        params.append(feature_type)
        
    if bbox:
        conditions.append("ST_Intersects(geometry, ST_MakeEnvelope(%s, %s, %s, %s, 4326))")
        params.extend(bbox)
        
    where_clause = " AND ".join(conditions)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Count
        cur.execute(f"SELECT COUNT(*) FROM features WHERE {where_clause}", params)
        total = cur.fetchone()["count"]
        
        # Paginated fetch
        query = f"""
            SELECT 
                id, feature_type, ST_AsText(geometry) as geometry, tags
            FROM features
            WHERE {where_clause}
            ORDER BY id
            LIMIT %s OFFSET %s
        """
        cur.execute(query, params + [limit, offset])
        return cur.fetchall(), total
