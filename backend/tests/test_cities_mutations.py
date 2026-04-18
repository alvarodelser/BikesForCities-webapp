import pytest
import pandas as pd
from datetime import date
from backend.database.db_io import (
    get_or_create_city,
    put_city_modes,
    update_city_wikidata,
    get_city_details,
    upsert_ingestion_status,
    get_ingestion_status,
    put_historical_mayors,
    put_city_elections,
    put_city_councilors,
    put_city_budgets
)

def test_get_or_create_city_inserts_new(transactional_db):
    """
    Ensures that calling get_or_create_city creates a new entry and returns an ID.
    Rollback happens automatically at the end.
    """
    city_name = "MutationTestCity"
    city_id = get_or_create_city(
        transactional_db,
        name=city_name,
        description="A test city",
        center_lat=45.0,
        center_lon=-90.0
    )
    assert city_id is not None
    assert isinstance(city_id, int)
    
def test_get_or_create_city_updates_existing_on_conflict(transactional_db):
    name = "ConflictTestCity"
    # First insert
    city_id_1 = get_or_create_city(transactional_db, name=name)
    update_city_wikidata(transactional_db, city_id_1, population=100)
    
    # Second insert with updated properties (name conflict)
    city_id_2 = get_or_create_city(transactional_db, name=name)
    update_city_wikidata(transactional_db, city_id_2, population=500)
    
    # Verify ID is the same
    assert city_id_1 == city_id_2
    
    # Verify updated properties
    details = get_city_details(transactional_db, city_id_1)
    assert details["population"] == 500

def test_put_city_modes(transactional_db):
    city_id = get_or_create_city(transactional_db, name="ModesTestCity")
    
    modes = {"infrastructure": True, "traffic": False, "stations": True}
    put_city_modes(transactional_db, city_id, modes)
    
    details = get_city_details(transactional_db, city_id)
    assert details["infrastructure"] is True
    assert details["traffic"] is False
    assert details["stations"] is True
    assert details["accidents"] is False # Default

def test_update_city_wikidata(transactional_db):
    city_id = get_or_create_city(transactional_db, name="WikidataTestCity")
    
    update_city_wikidata(
        transactional_db,
        city_id,
        population=100000,
        website="http://test.com",
        mayor="Test Mayor",
        mayor_party="Test Party"
    )
    
    details = get_city_details(transactional_db, city_id)
    assert details["population"] == 100000
    assert details["mayor"] == "Test Mayor"
    assert details["mayor_party"] == "Test Party"

def test_ingestion_status_upsert_and_get(transactional_db):
    city_id = get_or_create_city(transactional_db, name="IngestionTestCity")

    upsert_ingestion_status(
        transactional_db,
        "020_load_osm",
        "RUNNING",
        city_id=city_id,
        details={"step": "nodes"}
    )

    status = get_ingestion_status(transactional_db, "020_load_osm", city_id=city_id)
    assert status is not None
    assert status["status"] == "RUNNING"
    assert status["details"]["step"] == "nodes"

    upsert_ingestion_status(
        transactional_db,
        "020_load_osm",
        "SUCCESS",
        city_id=city_id,
        details={"step": "done"}
    )
    status2 = get_ingestion_status(transactional_db, "020_load_osm", city_id=city_id)
    assert status2["status"] == "SUCCESS"
    assert status2["details"]["step"] == "done"

def test_put_historical_mayors(transactional_db):
    city_id = get_or_create_city(transactional_db, name="MayorsTestCity")
    
    data = {
        "mayorLabel": ["Mayor A", "Mayor B"],
        "partyLabel": ["Party X", "Party Z"],
        "start": [pd.Timestamp('2000-01-01'), pd.Timestamp('2010-01-01')],
        "end": [pd.Timestamp('2010-01-01'), pd.NaT]
    }
    df = pd.DataFrame(data)
    
    # Because put_historical_mayors doesn't return anything, we just ensure it executes cleanly.
    put_historical_mayors(transactional_db, city_id, df)
    
def test_put_city_elections_and_councilors(transactional_db):
    city_id = get_or_create_city(transactional_db, name="ElectionsTestCity")
    
    elections_data = {
        "year": [2020, 2020],
        "party": ["Party A", "Party B"],
        "votes": [1000, 800],
        "councilors": [10, 8]
    }
    elections_df = pd.DataFrame(elections_data)
    put_city_elections(transactional_db, city_id, elections_df)
    
    councilors_data = {
        "year": [2020, 2020],
        "party": ["Party A", "Party B"],
        "name": ["Candidate 1", "Candidate 2"],
        "elected": [True, False]
    }
    councilors_df = pd.DataFrame(councilors_data)
    put_city_councilors(transactional_db, city_id, councilors_df)

def test_put_city_budgets(transactional_db):
    city_id = get_or_create_city(transactional_db, name="BudgetsTestCity")
    
    lines = [
        {"category_name": "Taxes", "line_type": "INCOME", "amount": 5000},
        {"category_name": "Parks", "line_type": "EXPENSE", "amount": 2000}
    ]
    budget_id = put_city_budgets(
        transactional_db,
        city_id,
        year=2024,
        total_income=5000,
        total_expenses=2000,
        public_debt=1000,
        lines_list=lines
    )
    assert budget_id is not None
    assert isinstance(budget_id, int)
