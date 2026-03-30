"""
features.py – CRUD for OSM features table.
"""
from typing import List, Optional, Tuple


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
