import datetime as dt

from backend.database.db_io import (
    get_or_create_city,
    upsert_city_metrics,
    get_total_active_stations,
    upsert_estimated_trips_interval,
)


def test_upsert_city_metrics_overwrite(transactional_db):
    """
    Ensure upsert_city_metrics inserts and then overwrites metrics for the same
    (city_id, metric_month) pair.
    """
    city_id = get_or_create_city(transactional_db, name="MetricsTestCity")
    metric_month = dt.datetime(2024, 1, 1, tzinfo=dt.timezone.utc)

    upsert_city_metrics(
        transactional_db,
        city_id=city_id,
        metric_month=metric_month,
        coverage=0.5,
        total_km=10.0,
        estimated_monthly_trips=1000.0,
        total_stations=20,
        station_downtime=5.0,
    )

    # Upsert again with different values to ensure overwrite behavior
    upsert_city_metrics(
        transactional_db,
        city_id=city_id,
        metric_month=metric_month,
        coverage=0.8,
        total_km=12.0,
        estimated_monthly_trips=1500.0,
        total_stations=25,
        station_downtime=7.5,
    )

    with transactional_db.cursor() as cur:
        cur.execute(
            """
            SELECT coverage, total_kilometers, estimated_monthly_trips,
                   total_stations, avg_station_downtime
            FROM city_metrics
            WHERE city_id = %s AND metric_month = %s
            """,
            (city_id, metric_month),
        )
        row = cur.fetchone()

    assert row is not None
    coverage, total_km, trips, stations, downtime = row
    assert coverage == 0.8
    assert total_km == 12.0
    assert trips == 1500.0
    assert stations == 25
    assert downtime == 7.5


def test_upsert_estimated_trips_interval_and_active_stations(transactional_db):
    """
    Smoke-test for upsert_estimated_trips_interval and get_total_active_stations:
    - Inserts a small set of readings into station_readings.
    - Inserts estimated trips per interval.
    - Confirms total_active_stations matches the stations present.
    """
    city_id = get_or_create_city(transactional_db, name="MetricsStationsCity")

    # Prepare some station_readings rows in the month of January 2024
    start = dt.datetime(2024, 1, 1, tzinfo=dt.timezone.utc)
    end = dt.datetime(2024, 2, 1, tzinfo=dt.timezone.utc)

    with transactional_db.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO station_readings (
                citybikes_network_id, station_id, observed_at,
                available_bikes, empty_slots, city_id, extra
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            [
                ("net_m", "S1", start, 5, 10, city_id, None),
                ("net_m", "S2", start + dt.timedelta(hours=1), 7, 8, city_id, None),
            ],
        )

    # Upsert some estimated trips for those intervals (sanity only)
    upsert_estimated_trips_interval(
        transactional_db,
        [
            (city_id, start, 100.0),
            (city_id, start + dt.timedelta(hours=1), 120.0),
        ],
    )

    # There are two distinct station_ids in that window
    total_active = get_total_active_stations(transactional_db, city_id, start, end)
    assert total_active == 2

