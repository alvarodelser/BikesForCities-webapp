import json
import os
import tempfile
from pathlib import Path
from scripts.news_scrapper import load_scraper_metadata, save_scraper_metadata


def test_load_scraper_metadata_nonexistent():
    """Test loading metadata when file doesn't exist returns empty structure."""
    with tempfile.TemporaryDirectory() as tmpdir:
        original_path = None  # Will set in function
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
