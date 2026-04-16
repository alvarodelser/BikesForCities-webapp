"""
test_integrity_stations.py – Data-integrity checks for stations and readings.

Covers: station structure, station proximity to city centre,
station-readings sanity bounds, and paginated endpoint consistency.
"""
import math
import pytest

from backend.database.db_io import (
    get_all_cities,
    get_stations,
    get_paginated_stations,
)

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Station structure (migrated + corrected from test_data_integrity)
# ---------------------------------------------------------------------------
# get_stations returns: (id, station_id, name, lat, lon, citybikes_network_id,
#                        extra, estimated_monthly_trips, downtime_minutes)
#   index:               0       1         2    3    4         5

def test_stations_structure(db_connection):
    """Station tuples have valid lat/lon and non-null identifiers."""
    cities = get_all_cities(db_connection)
    has_data = False
    for city in cities:
        stations = get_stations(db_connection, city[0])
        if stations:
            has_data = True
            for st in stations[:20]:   # sample
                lat, lon = st[3], st[4]
                citybikes_network_id = st[5]
                station_id = st[1]
                assert -90 <= lat <= 90, f"Station lat {lat} out of range"
                assert -180 <= lon <= 180, f"Station lon {lon} out of range"
                assert station_id is not None, "station_id must not be null"
                assert citybikes_network_id is not None, "citybikes_network_id must not be null"
    if not has_data:
        pytest.skip("No station data in the database.")


def test_stations_near_city_center(db_connection):
    """All stations must lie within (city radius + 10 km) of the city centre."""
    cities = get_all_cities(db_connection)
    has_data = False
    for city in cities:
        city_id, name = city[0], city[1]
        center_lat, center_lon, radius = city[4], city[5], city[6]
        if None in (center_lat, center_lon, radius):
            continue
        stations = get_stations(db_connection, city_id)
        if not stations:
            continue
        has_data = True
        threshold = radius + 10.0
        for st in stations:
            lat, lon = st[3], st[4]
            dist = _haversine(center_lat, center_lon, lat, lon)
            assert dist <= threshold, (
                f"{name}: station '{st[1]}' ({lat:.4f},{lon:.4f}) is {dist:.1f} km from centre "
                f"(limit {threshold:.1f} km)"
            )
    if not has_data:
        pytest.skip("No station data in the database.")


# ---------------------------------------------------------------------------
# Station readings
# ---------------------------------------------------------------------------

def test_station_readings_sensible(db_connection):
    """
    station_readings must have:
    - available_bikes >= 0
    - empty_slots >= 0
    - available_bikes + empty_slots <= 200  (reasonable dock capacity)
    """
    with db_connection.cursor() as cur:
        cur.execute(
            """
            SELECT citybikes_network_id, station_id, observed_at,
                   available_bikes, empty_slots
            FROM station_readings
            LIMIT 5000
            """
        )
        rows = cur.fetchall()

    if not rows:
        pytest.skip("No station_readings data in the database.")

    for net_id, sta_id, ts, bikes, slots in rows:
        if bikes is not None:
            assert bikes >= 0, f"{net_id}/{sta_id} at {ts}: available_bikes={bikes} is negative"
        if slots is not None:
            assert slots >= 0, f"{net_id}/{sta_id} at {ts}: empty_slots={slots} is negative"
        if bikes is not None and slots is not None:
            assert bikes + slots <= 200, (
                f"{net_id}/{sta_id} at {ts}: bikes+slots={bikes+slots} exceeds 200 "
                f"(bikes={bikes}, slots={slots})"
            )


# ---------------------------------------------------------------------------
# Pagination consistency (migrated from test_data_integrity)
# ---------------------------------------------------------------------------

def test_pagination_stations(db_connection):
    """Paginated station count must match full get_stations count."""
    cities = get_all_cities(db_connection)
    if not cities:
        pytest.skip("No cities available.")

    for city_id, *_ in cities[:5]:
        stations_list = get_stations(db_connection, city_id)
        paginated, total = get_paginated_stations(db_connection, city_id, limit=50, offset=0)
        # get_paginated_stations counts ALL stations (incl. merged); get_stations only non-merged.
        # So total >= len(stations_list).
        assert total >= len(stations_list)
        assert len(paginated) <= 50
