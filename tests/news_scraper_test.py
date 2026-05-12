import json
import os
import tempfile
from scripts.news_scrapper import load_scraper_metadata, save_scraper_metadata


def test_load_scraper_metadata_nonexistent():
    """Test loading metadata when file doesn't exist returns empty structure."""
    with tempfile.TemporaryDirectory() as tmpdir:
        result = load_scraper_metadata(tmpdir)
        assert result["fetched_months"] == []
        assert result["failed_months"] == []
        assert result["oldest_target_month"] == "2023-05"


def test_load_scraper_metadata_existing():
    """Test loading metadata from existing file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        metadata_path = os.path.join(tmpdir, "scraper_metadata.json")
        test_data = {
            "fetched_months": ["2026-05", "2026-04"],
            "failed_months": [],
            "oldest_target_month": "2023-05",
            "last_updated": "2026-05-12T10:00:00Z"
        }
        with open(metadata_path, 'w') as f:
            json.dump(test_data, f)

        result = load_scraper_metadata(tmpdir)
        assert result["fetched_months"] == ["2026-05", "2026-04"]
        assert result["oldest_target_month"] == "2023-05"


def test_save_scraper_metadata():
    """Test saving metadata to file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        metadata = {
            "fetched_months": ["2026-05"],
            "failed_months": [],
            "oldest_target_month": "2023-05",
            "last_updated": "2026-05-12T10:00:00Z"
        }
        save_scraper_metadata(metadata, tmpdir)

        metadata_path = os.path.join(tmpdir, "scraper_metadata.json")
        assert os.path.exists(metadata_path)

        with open(metadata_path, 'r') as f:
            saved = json.load(f)
        assert saved["fetched_months"] == ["2026-05"]


def test_get_next_unfetched_month_first_run():
    """Test first run returns most recent month (May 2026)."""
    metadata = {
        "fetched_months": [],
        "failed_months": [],
        "oldest_target_month": "2023-05",
        "last_updated": None
    }
    from scripts.news_scrapper import get_next_unfetched_month
    result = get_next_unfetched_month(metadata)
    assert result == "2026-05"


def test_get_next_unfetched_month_progression():
    """Test month progression works backwards."""
    metadata = {
        "fetched_months": ["2026-05"],
        "failed_months": [],
        "oldest_target_month": "2023-05",
        "last_updated": None
    }
    from scripts.news_scrapper import get_next_unfetched_month
    result = get_next_unfetched_month(metadata)
    assert result == "2026-04"


def test_get_next_unfetched_month_complete():
    """Test returns None when all months fetched."""
    metadata = {
        "fetched_months": ["2026-05", "2026-04", "2026-03", "2026-02", "2026-01",
                          "2025-12", "2025-11", "2025-10", "2025-09", "2025-08",
                          "2025-07", "2025-06", "2025-05", "2025-04", "2025-03",
                          "2025-02", "2025-01", "2024-12", "2024-11", "2024-10",
                          "2024-09", "2024-08", "2024-07", "2024-06", "2024-05",
                          "2024-04", "2024-03", "2024-02", "2024-01", "2023-12",
                          "2023-11", "2023-10", "2023-09", "2023-08", "2023-07",
                          "2023-06", "2023-05"],
        "failed_months": [],
        "oldest_target_month": "2023-05",
        "last_updated": None
    }
    from scripts.news_scrapper import get_next_unfetched_month
    result = get_next_unfetched_month(metadata)
    assert result is None


def test_get_next_unfetched_month_skips_failed():
    """Test skips failed months for later retry."""
    metadata = {
        "fetched_months": ["2026-05"],
        "failed_months": ["2026-04"],
        "oldest_target_month": "2023-05",
        "last_updated": None
    }
    from scripts.news_scrapper import get_next_unfetched_month
    result = get_next_unfetched_month(metadata)
    assert result == "2026-03"
