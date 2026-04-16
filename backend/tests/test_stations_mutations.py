import datetime as dt
from backend.database.db_io import (
    get_or_create_city,
    upsert_stations,
    insert_station_readings,
)


def test_upsert_stations_conflicts_and_updates(transactional_db):
    """
    Ensure upsert_stations inserts stations and correctly updates on conflict
    without creating duplicates.
    """
    city_id = get_or_create_city(transactional_db, name="StationsTestCity")
    network_id = "test_network"

    first_seen = dt.datetime(2024, 1, 1, tzinfo=dt.timezone.utc)
    last_seen = dt.datetime(2024, 1, 2, tzinfo=dt.timezone.utc)

    rows = [
        (
            city_id,
            network_id,
            "S1",
            "Station One",
            40.0,
            -3.0,
            -3.0,
            40.0,
            None,
            first_seen,
            last_seen,
            None,
        )
    ]

    inserted = upsert_stations(transactional_db, rows)
    assert inserted == 1

    # Re-upsert same station with updated name and later last_seen
    later = dt.datetime(2024, 1, 3, tzinfo=dt.timezone.utc)
    rows_updated = [
        (
            city_id,
            network_id,
            "S1",
            "Station One Renamed",
            40.0,
            -3.0,
            -3.0,
            40.0,
            None,
            first_seen,
            later,
            None,
        )
    ]
    upsert_stations(transactional_db, rows_updated)

    with transactional_db.cursor() as cur:
        cur.execute(
            """
            SELECT name, first_seen, last_seen
            FROM stations
            WHERE city_id = %s AND citybikes_network_id = %s AND station_id = %s
            """,
            (city_id, network_id, "S1"),
        )
        name, fs, ls = cur.fetchone()

    assert name == "Station One Renamed"
    # first_seen should be preserved
    assert fs == first_seen
    # last_seen should move forward
    assert ls == later


def test_insert_station_readings_idempotent(transactional_db):
    """
    Ensure insert_station_readings inserts readings and respects ON CONFLICT
    on (citybikes_network_id, station_id, observed_at).
    """
    city_id = get_or_create_city(transactional_db, name="StationReadingsCity")
    network_id = "test_network_readings"

    observed_at = dt.datetime(2024, 1, 1, 12, 0, tzinfo=dt.timezone.utc)
    rows = [
        (network_id, "S1", observed_at, 5, 10, city_id, None),
        (network_id, "S2", observed_at, 7, 8, city_id, None),
    ]

    inserted = insert_station_readings(transactional_db, rows)
    assert inserted == 2

    # Re-insert the exact same rows; ON CONFLICT DO NOTHING should prevent duplicates
    inserted_again = insert_station_readings(transactional_db, rows)
    assert inserted_again == 0

    with transactional_db.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM station_readings
            WHERE city_id = %s AND citybikes_network_id = %s
            """,
            (city_id, network_id),
        )
        count = cur.fetchone()[0]

    assert count == 2

