"""
test_integrity_features.py – Data-integrity checks for OSM features.

Covers: paginated feature count consistency, and geometry centroid
proximity to the city centre (via PostGIS ST_Distance).
"""
import pytest

from backend.database.db_io import (
    get_all_cities,
    get_paginated_features,
)


# ---------------------------------------------------------------------------
# Pagination (migrated from test_data_integrity)
# ---------------------------------------------------------------------------

def test_features_pagination(db_connection):
    """Paginated feature total must be >= the number of items in the page."""
    cities = get_all_cities(db_connection)
    if not cities:
        pytest.skip("No cities available.")

    for city_id, *_ in cities[:5]:
        page, total = get_paginated_features(db_connection, city_id, limit=50, offset=0)
        assert total >= len(page), (
            f"city_id={city_id}: paginated total {total} < page length {len(page)}"
        )


# ---------------------------------------------------------------------------
# Geometry proximity to city centre (PostGIS)
# ---------------------------------------------------------------------------

def test_features_geometry_near_city(db_connection):
    """
    A sample of features (up to 50 per city) must have their geometry centroid
    within (city radius + 15 km) of the city centre.

    Uses PostGIS ST_Distance with geography cast for accuracy.
    """
    cities = get_all_cities(db_connection)
    has_data = False

    for city in cities:
        city_id, name = city[0], city[1]
        center_lat, center_lon, radius = city[4], city[5], city[6]
        if None in (center_lat, center_lon, radius):
            continue

        with db_connection.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    feature_type,
                    ST_Distance(
                        ST_Centroid(geometry)::geography,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                    ) / 1000.0  AS dist_km
                FROM features
                WHERE city_id = %s
                LIMIT 50
                """,
                (center_lon, center_lat, city_id),
            )
            rows = cur.fetchall()

        if not rows:
            continue

        has_data = True
        threshold = radius + 15.0
        for feat_id, feat_type, dist_km in rows:
            if dist_km is None:
                continue
            assert dist_km <= threshold, (
                f"{name}: feature id={feat_id} type='{feat_type}' centroid is "
                f"{dist_km:.1f} km from city centre (limit {threshold:.1f} km)"
            )

    if not has_data:
        pytest.skip("No features data with city coordinates available.")
