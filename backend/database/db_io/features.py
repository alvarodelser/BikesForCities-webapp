"""
features.py – CRUD for OSM features table.
"""
from typing import List, Optional, Tuple
from psycopg2.extras import RealDictCursor


def put_features(conn, city_id: int, features_data: List[Tuple]):
    """Bulk insert features.

    Tuple layout: (feature_type, geometry_wkt, tags_json)
    """
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO features (city_id, feature_type, geometry, tags)
            VALUES (%s, %s, ST_GeomFromText(%s, 4326), %s)
            ON CONFLICT DO NOTHING
            """,
            [(city_id, ft, geom, tags) for ft, geom, tags in features_data],
        )
    conn.commit()


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
