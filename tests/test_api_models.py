"""Tests for API response models against DB-layer row shapes."""
import datetime

from backend.api.models import MayorRecord, ElectionResult


def test_mayor_record_accepts_db_date_objects():
    """psycopg2 returns datetime.date for DATE columns; the model must accept them.

    Regression test for /cities/{id}/mayors returning 500 on every city:
    MayorRecord(**row) raised ValidationError because start_date/end_date
    were typed as str while the DB layer yields datetime.date.
    """
    row = {
        "name": "José Luis Martínez-Almeida",
        "party": "Partido Popular",
        "start_date": datetime.date(2019, 6, 15),
        "end_date": None,
    }
    record = MayorRecord(**row)
    assert record.start_date == datetime.date(2019, 6, 15)
    assert record.end_date is None
    # JSON serialization must produce ISO strings for the frontend
    assert record.model_dump(mode="json")["start_date"] == "2019-06-15"


def test_election_result_accepts_db_row():
    row = {"year": 2023, "party": "PSOE", "votes": 123456, "councilors": 12}
    result = ElectionResult(**row)
    assert result.year == 2023
    assert result.councilors == 12


def test_councilor_record_accepts_db_row():
    from backend.api.models import CouncilorRecord

    row = {"year": 2023, "party": "PP", "name": "José Luis Martínez-Almeida"}
    record = CouncilorRecord(**row)
    assert record.name == "José Luis Martínez-Almeida"


def test_mayors_timeline_response_includes_councilors():
    from backend.api.models import CouncilorRecord, MayorsTimelineResponse

    resp = MayorsTimelineResponse(
        mayors=[],
        elections=[],
        councilors=[CouncilorRecord(year=2023, party="PP", name="A B")],
        message="ok",
    )
    assert resp.model_dump(mode="json")["councilors"] == [
        {"year": 2023, "party": "PP", "name": "A B"}
    ]
