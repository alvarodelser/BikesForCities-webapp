"""
test_integrity_cities.py – Data-integrity checks for city-level data.

Covers: coordinates (Spain bounds), mayor/website/wikidata presence,
infrastructure mode flag, historical mayors timeline, estimated trips,
city elections, and city budgets.
"""
import math
import warnings
import pytest
from itertools import groupby

from backend.database.db_io import (
    get_all_cities,
    get_city_details,
    get_city_modes,
    get_city_budgets,
)

# ---------------------------------------------------------------------------
# Helpers
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
# Basic structure (migrated from test_data_integrity.py)
# ---------------------------------------------------------------------------

def test_get_all_cities_structure(db_connection):
    """get_all_cities returns non-empty list with sensible field types."""
    cities = get_all_cities(db_connection)
    assert isinstance(cities, list)
    assert len(cities) > 0, "Database should have at least one city."

    for city in cities:
        assert isinstance(city[0], int), "City id must be int"
        assert isinstance(city[1], str) and len(city[1]) > 0, "City name must be non-empty"
        lat, lon = city[4], city[5]
        if lat is not None and lon is not None:
            assert -90 <= lat <= 90, f"Invalid lat {lat} for {city[1]}"
            assert -180 <= lon <= 180, f"Invalid lon {lon} for {city[1]}"
        if city[6] is not None:
            assert city[6] > 0, f"Radius must be positive for {city[1]}"
        if city[8] is not None:
            assert city[8] >= 0, f"Population must be non-negative for {city[1]}"


def test_city_details_structure(db_connection):
    """get_city_details returns expected keys and coherent aggregate values."""
    cities = get_all_cities(db_connection)
    first_id = cities[0][0]
    details = get_city_details(db_connection, first_id)
    assert details is not None
    assert details["id"] == first_id
    for key in ("name", "center_lat", "center_lon", "infrastructure"):
        assert key in details, f"Missing key '{key}' in city details"
    if details.get("stations_count") is not None:
        assert details["stations_count"] >= 0
    if details.get("monthly_trips") is not None:
        assert details["monthly_trips"] >= 0


# ---------------------------------------------------------------------------
# Spain geographic bounds
# ---------------------------------------------------------------------------

def test_city_coordinates_near_spain(db_connection):
    """All city centres must fall within mainland-Spain bounding box and have radius < 50 km."""
    SPAIN_LAT = (35.0, 44.0)
    SPAIN_LON = (-9.0, 4.0)
    cities = get_all_cities(db_connection)
    for city in cities:
        name, lat, lon, radius = city[1], city[4], city[5], city[6]
        if lat is None or lon is None:
            pytest.fail(f"{name}: missing coordinates")
        assert SPAIN_LAT[0] <= lat <= SPAIN_LAT[1], (
            f"{name}: lat {lat} outside Spain range {SPAIN_LAT}"
        )
        assert SPAIN_LON[0] <= lon <= SPAIN_LON[1], (
            f"{name}: lon {lon} outside Spain range {SPAIN_LON}"
        )
        if radius is not None:
            assert radius < 50000, f"{name}: radius {radius} m should be < 50000 m"


# ---------------------------------------------------------------------------
# Political / metadata presence
# ---------------------------------------------------------------------------

def test_city_has_mayor_and_website(db_connection):
    """Every city should have mayor, mayor_party, and website populated."""
    cities = get_all_cities(db_connection)
    # mayor (index 23) and mayor_party (index 24) are in the tuple
    for city in cities:
        name, mayor, mayor_party = city[1], city[23], city[24]
        assert mayor and str(mayor).strip(), f"{name}: mayor is empty"
        assert mayor_party and str(mayor_party).strip(), f"{name}: mayor_party is empty"

    # website is not in get_all_cities tuple → query directly
    with db_connection.cursor() as cur:
        cur.execute("SELECT name FROM cities WHERE website IS NULL OR TRIM(website) = ''")
        missing = [r[0] for r in cur.fetchall()]
    assert not missing, f"Cities with missing website: {missing}"


def test_city_has_wikidata_id(db_connection):
    """Every city must have a wikidata_id set."""
    cities = get_all_cities(db_connection)
    for city in cities:
        name, wikidata_id = city[1], city[3]
        assert wikidata_id and str(wikidata_id).strip(), f"{name}: wikidata_id is missing"


# ---------------------------------------------------------------------------
# City modes
# ---------------------------------------------------------------------------

def test_infrastructure_mode_enabled(db_connection):
    """Every city must have the infrastructure mode flag enabled."""
    cities = get_all_cities(db_connection)
    for city in cities:
        name = city[1]
        modes = get_city_modes(db_connection, city[0])
        assert modes is not None, f"{name}: no city_modes row found"
        assert modes["infrastructure"] is True, f"{name}: infrastructure mode is not enabled"


# ---------------------------------------------------------------------------
# Historical mayors
# ---------------------------------------------------------------------------

def test_historical_mayors_end_after_start(db_connection):
    """For all mayor rows that have both dates, end_date must be after start_date."""
    with db_connection.cursor() as cur:
        cur.execute(
            """
            SELECT c.name, hm.name, hm.start_date, hm.end_date
            FROM historical_mayors hm
            JOIN cities c ON c.id = hm.city_id
            WHERE hm.start_date IS NOT NULL AND hm.end_date IS NOT NULL
            """
        )
        rows = cur.fetchall()

    if not rows:
        pytest.skip("No historical mayor rows with both dates.")

    for city_name, mayor_name, start, end in rows:
        assert end >= start, (
            f"{city_name}: mayor '{mayor_name}' end_date {end} < start_date {start}"
        )


def test_historical_mayors_cover_period(db_connection):
    """No consecutive mayoral terms should have a gap > 365 days (1 year) between them."""
    with db_connection.cursor() as cur:
        cur.execute(
            """
            SELECT hm.city_id, c.name, hm.start_date, hm.end_date
            FROM historical_mayors hm
            JOIN cities c ON c.id = hm.city_id
            WHERE hm.start_date IS NOT NULL
            ORDER BY hm.city_id, hm.start_date
            """
        )
        rows = cur.fetchall()

    if not rows:
        pytest.skip("No historical mayors data available.")

    gaps: list[str] = []
    for city_id, group in groupby(rows, key=lambda r: r[0]):
        terms = list(group)
        city_name = terms[0][1]
        for i in range(1, len(terms)):
            prev_end = terms[i - 1][3]
            curr_start = terms[i][2]
            if prev_end is None or curr_start is None:
                continue
            gap = (curr_start - prev_end).days
            if gap > 365:
                gaps.append(f"{city_name}: {gap}-day gap before {curr_start}")

    if gaps:
        warnings.warn(f"Large gaps between consecutive mayor terms:\n" + "\n".join(gaps))


# ---------------------------------------------------------------------------
# Estimated trips
# ---------------------------------------------------------------------------

def test_estimated_trips_sensible(db_connection):
    """estimated_trips_per_interval values must be in [0, 100 000]."""
    with db_connection.cursor() as cur:
        cur.execute(
            "SELECT city_id, observed_at, estimated_trips FROM estimated_trips_per_interval"
        )
        rows = cur.fetchall()

    if not rows:
        pytest.skip("No estimated trips data available.")

    for city_id, observed_at, trips in rows:
        assert 0 <= trips <= 100_000, (
            f"city_id={city_id} at {observed_at}: estimated_trips={trips} out of [0, 100_000]"
        )


# ---------------------------------------------------------------------------
# City elections
# ---------------------------------------------------------------------------

def test_city_elections_sensible(db_connection):
    """city_elections: votes >= 0, councilors >= 0, year >= 1900."""
    with db_connection.cursor() as cur:
        cur.execute(
            "SELECT city_id, year, party, votes, councilors FROM city_elections"
        )
        rows = cur.fetchall()

    if not rows:
        pytest.skip("No city elections data available.")

    for city_id, year, party, votes, councilors in rows:
        assert year >= 1900, f"city_id={city_id}: election year {year} is unreasonably old"
        assert votes >= 0, f"city_id={city_id} {year}/{party}: votes={votes} is negative"
        assert councilors >= 0, f"city_id={city_id} {year}/{party}: councilors={councilors} is negative"


# ---------------------------------------------------------------------------
# City budgets (migrated)
# ---------------------------------------------------------------------------

def test_city_budgets_integrity(db_connection):
    """total_expenses must be non-negative for all budget rows."""
    cities = get_all_cities(db_connection)
    has_data = False
    for city in cities:
        budgets = get_city_budgets(db_connection, city[0])
        if budgets:
            has_data = True
            for b in budgets:
                exp = b["total_expenses"]
                if exp is not None:
                    assert exp >= 0, f"{city[1]}: negative total_expenses {exp}"
    if not has_data:
        pytest.skip("No budget data in the database.")
