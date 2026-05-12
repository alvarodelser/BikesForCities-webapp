# Monthly Progressive News Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement monthly backward-iterating news scraper that fetches Spanish mobility articles from May 2026 back to May 2023, tracking progress to avoid re-fetching and respecting rate limits.

**Architecture:** Metadata file tracks fetched/failed months. Scraper loads metadata, determines next unfetched month, fetches articles with date filtering, deduplicates using existing logic, updates metadata, waits 1-2s. On-demand execution means user controls pacing.

**Tech Stack:** Python 3, feedparser, BeautifulSoup, JSON, datetime

---

## Task 1: Add Metadata Loading and Saving Functions

**Files:**
- Modify: `scripts/news_scrapper.py`
- Test: `tests/news_scraper_test.py` (new file)

- [ ] **Step 1: Create test file with import statement**

Create `tests/news_scraper_test.py`:

```python
import json
import os
import tempfile
from pathlib import Path
from scripts.news_scrapper import load_scraper_metadata, save_scraper_metadata
```

- [ ] **Step 2: Write test for loading nonexistent metadata file**

Add to `tests/news_scraper_test.py`:

```python
def test_load_scraper_metadata_nonexistent():
    """Test loading metadata when file doesn't exist returns empty structure."""
    with tempfile.TemporaryDirectory() as tmpdir:
        original_path = None  # Will set in function
        result = load_scraper_metadata(tmpdir)
        assert result["fetched_months"] == []
        assert result["failed_months"] == []
        assert result["oldest_target_month"] == "2023-05"
```

- [ ] **Step 3: Write test for loading existing metadata file**

Add to `tests/news_scraper_test.py`:

```python
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
```

- [ ] **Step 4: Write test for saving metadata**

Add to `tests/news_scraper_test.py`:

```python
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
```

- [ ] **Step 5: Implement load_scraper_metadata() in news_scrapper.py**

Add to `scripts/news_scrapper.py` after imports:

```python
def load_scraper_metadata(base_path="data/news"):
    """
    Load scraper metadata tracking which months have been fetched.
    Returns dict with fetched_months, failed_months, oldest_target_month, last_updated.
    """
    import os
    
    metadata_path = os.path.join(base_path, "scraper_metadata.json")
    
    if not os.path.exists(metadata_path):
        return {
            "fetched_months": [],
            "failed_months": [],
            "oldest_target_month": "2023-05",
            "last_updated": None
        }
    
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        print(f"Warning: Could not load {metadata_path}, starting fresh")
        return {
            "fetched_months": [],
            "failed_months": [],
            "oldest_target_month": "2023-05",
            "last_updated": None
        }
```

- [ ] **Step 6: Implement save_scraper_metadata() in news_scrapper.py**

Add to `scripts/news_scrapper.py`:

```python
def save_scraper_metadata(metadata, base_path="data/news"):
    """
    Save scraper metadata to data/news/scraper_metadata.json.
    Updates last_updated timestamp.
    """
    import os
    from datetime import datetime
    
    metadata["last_updated"] = datetime.utcnow().isoformat() + "Z"
    
    metadata_path = os.path.join(base_path, "scraper_metadata.json")
    os.makedirs(base_path, exist_ok=True)
    
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Metadata saved: {len(metadata['fetched_months'])} months fetched")
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pytest tests/news_scraper_test.py::test_load_scraper_metadata_nonexistent -v`
Run: `pytest tests/news_scraper_test.py::test_load_scraper_metadata_existing -v`
Run: `pytest tests/news_scraper_test.py::test_save_scraper_metadata -v`

Expected: All 3 tests PASS

- [ ] **Step 8: Commit**

```bash
git add scripts/news_scrapper.py tests/news_scraper_test.py
git commit -m "feat: add metadata loading and saving functions"
```

---

## Task 2: Implement Month Progression Logic

**Files:**
- Modify: `scripts/news_scrapper.py`
- Test: `tests/news_scraper_test.py`

- [ ] **Step 1: Write test for getting next unfetched month**

Add to `tests/news_scraper_test.py`:

```python
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
```

- [ ] **Step 2: Write test for progression backwards**

Add to `tests/news_scraper_test.py`:

```python
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
```

- [ ] **Step 3: Write test for completion (all months fetched)**

Add to `tests/news_scraper_test.py`:

```python
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
```

- [ ] **Step 4: Write test for skipping failed months (retry later)**

Add to `tests/news_scraper_test.py`:

```python
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
```

- [ ] **Step 5: Implement get_next_unfetched_month() in news_scrapper.py**

Add to `scripts/news_scrapper.py`:

```python
def get_next_unfetched_month(metadata):
    """
    Determine next month to fetch, working backwards from May 2026 to oldest_target_month.
    Returns month string (e.g., "2026-04") or None if all months complete.
    """
    from datetime import datetime, timedelta
    
    # Start from current month, work backwards
    current_date = datetime(2026, 5, 1)
    oldest_date = datetime(int(metadata["oldest_target_month"][:4]), 
                          int(metadata["oldest_target_month"][5:7]), 1)
    
    fetched = set(metadata.get("fetched_months", []))
    failed = set(metadata.get("failed_months", []))
    attempted = fetched | failed  # Both fetched and failed are attempted
    
    while current_date >= oldest_date:
        month_str = current_date.strftime("%Y-%m")
        if month_str not in attempted:
            return month_str
        # Move to previous month
        current_date = (current_date - timedelta(days=1)).replace(day=1)
    
    return None  # All months complete
```

- [ ] **Step 6: Run all new tests**

Run: `pytest tests/news_scraper_test.py::test_get_next_unfetched_month_first_run -v`
Run: `pytest tests/news_scraper_test.py::test_get_next_unfetched_month_progression -v`
Run: `pytest tests/news_scraper_test.py::test_get_next_unfetched_month_complete -v`
Run: `pytest tests/news_scraper_test.py::test_get_next_unfetched_month_skips_failed -v`

Expected: All 4 tests PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/news_scrapper.py tests/news_scraper_test.py
git commit -m "feat: add month progression logic for backward iteration"
```

---

## Task 3: Add Date Filtering to Queries

**Files:**
- Modify: `scripts/news_scrapper.py`

- [ ] **Step 1: Add helper function to generate date range filters**

Add to `scripts/news_scrapper.py`:

```python
def get_month_date_filters(month_str):
    """
    Generate date filters for Google News RSS query.
    Input: "2026-04" (YYYY-MM)
    Returns tuple: (after_date, before_date) as "YYYY-MM-DD" strings
    Example: ("2026-04-01", "2026-04-30")
    """
    year = int(month_str[:4])
    month = int(month_str[5:7])
    
    # First day of month
    after_date = f"{year:04d}-{month:02d}-01"
    
    # Last day of month (next month's first day - 1)
    if month == 12:
        next_month = 1
        next_year = year + 1
    else:
        next_month = month + 1
        next_year = year
    
    from datetime import datetime, timedelta
    last_day = datetime(next_year, next_month, 1) - timedelta(days=1)
    before_date = last_day.strftime("%Y-%m-%d")
    
    return (after_date, before_date)
```

- [ ] **Step 2: Add method to build query with date filters**

Add to `scripts/news_scrapper.py`:

```python
def build_rss_url_with_date_filter(query, after_date=None, before_date=None):
    """
    Build Google News RSS URL with optional date filters.
    If after_date/before_date provided, adds to query: "query after:DATE before:DATE"
    """
    if after_date and before_date:
        query = f"{query} after:{after_date} before:{before_date}"
    
    encoded_query = urllib.parse.quote(query)
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=es&gl=ES&ceid=ES:es"
    return rss_url
```

- [ ] **Step 3: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: add date filtering helpers for month-based queries"
```

---

## Task 4: Modify Main Scraper Function to Accept Month Parameter

**Files:**
- Modify: `scripts/news_scrapper.py`

- [ ] **Step 1: Update function signature to accept target_month and delay_seconds**

Replace the existing `scrape_spanish_mobility_news(max_results=100)` signature with:

```python
def scrape_spanish_mobility_news(max_results=100, target_month=None, delay_seconds=1.5):
    """
    Scrape Spanish mobility news from Google News RSS.
    Deduplicate against existing articles, merge duplicates.
    Save archive to movilidad_news.json and new articles to movilidad_news_new.json
    
    Args:
        max_results: Max articles to process per query (default 100)
        target_month: Optional month to fetch (e.g., "2026-04"). If None, fetches recent.
        delay_seconds: Seconds to wait after scraping (default 1.5 for rate limiting)
    """
```

- [ ] **Step 2: Update query building logic to use date filters when target_month provided**

Replace the loop starting at line 171 (`for query in queries:`) with:

```python
    # 2. Collect articles from multiple queries
    all_entries = []
    seen_urls = set()
    
    # Generate date filters if target month specified
    date_filters = None
    if target_month:
        date_filters = get_month_date_filters(target_month)

    for query in queries:
        if date_filters:
            rss_url = build_rss_url_with_date_filter(query, date_filters[0], date_filters[1])
        else:
            rss_url = build_rss_url_with_date_filter(query)
        
        feed = feedparser.parse(rss_url)

        print(f"Fetching '{query}': found {len(feed.entries)} articles")

        for entry in feed.entries:
            # Skip duplicates within RSS results
            if entry.link not in seen_urls:
                all_entries.append(entry)
                seen_urls.add(entry.link)
```

- [ ] **Step 3: Add delay and return at end of function**

At the very end of `scrape_spanish_mobility_news()`, before the final print, add:

```python
    # Final delay for rate limiting
    import time
    time.sleep(delay_seconds)
```

- [ ] **Step 4: Update main block to handle target_month**

Replace the entire `if __name__ == "__main__":` block with:

```python
if __name__ == "__main__":
    import sys
    
    target_month = None
    
    # Check for --month argument
    if len(sys.argv) > 1 and sys.argv[1] == "--month":
        if len(sys.argv) > 2:
            target_month = sys.argv[2]
        else:
            print("Error: --month requires a month argument (e.g., 2026-04)")
            sys.exit(1)
    
    # If no month specified, auto-detect next unfetched month
    if not target_month:
        metadata = load_scraper_metadata()
        target_month = get_next_unfetched_month(metadata)
        
        if target_month:
            print(f"Auto-detected next month to fetch: {target_month}\n")
        else:
            print("All months have been fetched! Archive is complete.")
            sys.exit(0)
    
    # Run scraper for target month
    scrape_spanish_mobility_news(max_results=100, target_month=target_month, delay_seconds=1.5)
```

- [ ] **Step 5: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: add month parameter and date filtering to main scraper"
```

---

## Task 5: Integrate Metadata Tracking into Scraper

**Files:**
- Modify: `scripts/news_scrapper.py`

- [ ] **Step 1: Update scraper to track successful fetches in metadata**

At the end of `scrape_spanish_mobility_news()`, just before the final delay and after saving news, add:

```python
    # 8. Update metadata if target month was specified
    if target_month:
        metadata = load_scraper_metadata()
        
        if target_month not in metadata["fetched_months"]:
            metadata["fetched_months"].append(target_month)
            # Remove from failed if it was there (retry successful)
            if target_month in metadata["failed_months"]:
                metadata["failed_months"].remove(target_month)
        
        # Sort months in reverse chronological order for clarity
        metadata["fetched_months"].sort(reverse=True)
        save_scraper_metadata(metadata)
```

- [ ] **Step 2: Add error handling to mark failed months**

Wrap the query loop (lines that fetch from Google News) with error handling:

```python
    try:
        for query in queries:
            if date_filters:
                rss_url = build_rss_url_with_date_filter(query, date_filters[0], date_filters[1])
            else:
                rss_url = build_rss_url_with_date_filter(query)
            
            feed = feedparser.parse(rss_url)

            print(f"Fetching '{query}': found {len(feed.entries)} articles")

            for entry in feed.entries:
                # Skip duplicates within RSS results
                if entry.link not in seen_urls:
                    all_entries.append(entry)
                    seen_urls.add(entry.link)
    except Exception as e:
        if target_month:
            metadata = load_scraper_metadata()
            if target_month not in metadata["failed_months"]:
                metadata["failed_months"].append(target_month)
            save_scraper_metadata(metadata)
            print(f"✗ Error fetching {target_month}: {str(e)}")
        raise
```

- [ ] **Step 3: Test manual execution without month parameter**

Run: `cd /Users/alvarodelser/Projects/BikesForCities-webapp && python scripts/news_scrapper.py`

Expected: Should auto-detect next unfetched month and start fetching

- [ ] **Step 4: Test manual execution with month parameter**

Run: `cd /Users/alvarodelser/Projects/BikesForCities-webapp && python scripts/news_scrapper.py --month 2026-04`

Expected: Should fetch only April 2026 articles

- [ ] **Step 5: Verify metadata was created/updated**

Run: `cat data/news/scraper_metadata.json | python -m json.tool`

Expected: Should show fetched_months with the month(s) that were just processed

- [ ] **Step 6: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: integrate metadata tracking for monthly progress"
```

---

## Task 6: Write Integration Tests

**Files:**
- Test: `tests/news_scraper_test.py`

- [ ] **Step 1: Write integration test for single month fetch**

Add to `tests/news_scraper_test.py`:

```python
def test_scraper_integration_single_month(tmp_path, monkeypatch):
    """Test full scraper flow for a single month."""
    import os
    os.chdir(tmp_path)
    
    # Create data/news directory
    os.makedirs("data/news", exist_ok=True)
    
    # Create empty archive
    with open("data/news/movilidad_news.json", 'w') as f:
        json.dump([], f)
    
    # Mock feedparser to return test data
    from scripts import news_scrapper
    
    original_parse = None
    def mock_parse(url):
        class MockEntry:
            def __init__(self):
                self.title = "Test Article - Test Source"
                self.link = "http://example.com/test"
                self.summary = "<p>Test description</p>"
                self.published = "2026-04-15T10:00:00Z"
            def get(self, key, default=None):
                if key == 'source':
                    return {'title': 'Test News'}
                return default
        
        class MockFeed:
            entries = [MockEntry()]
        
        return MockFeed()
    
    monkeypatch.setattr(news_scrapper.feedparser, "parse", mock_parse)
    
    # Run scraper for April 2026
    news_scrapper.scrape_spanish_mobility_news(max_results=100, target_month="2026-04")
    
    # Verify metadata was updated
    metadata = news_scrapper.load_scraper_metadata()
    assert "2026-04" in metadata["fetched_months"]
    
    # Verify archive was updated
    with open("data/news/movilidad_news.json", 'r') as f:
        archive = json.load(f)
    assert len(archive) > 0
```

- [ ] **Step 2: Write test for metadata persistence across runs**

Add to `tests/news_scraper_test.py`:

```python
def test_scraper_metadata_persistence(tmp_path, monkeypatch):
    """Test that metadata persists across multiple runs."""
    import os
    os.chdir(tmp_path)
    os.makedirs("data/news", exist_ok=True)
    
    with open("data/news/movilidad_news.json", 'w') as f:
        json.dump([], f)
    
    from scripts import news_scrapper
    
    def mock_parse(url):
        class MockEntry:
            def __init__(self, link):
                self.title = f"Article {link}"
                self.link = link
                self.summary = "Test"
                self.published = "2026-04-15T10:00:00Z"
            def get(self, key, default=None):
                return {'title': 'Test'} if key == 'source' else default
        
        class MockFeed:
            entries = [MockEntry(f"http://test.com/{link}") for link in ["article1", "article2"]]
        
        return MockFeed()
    
    monkeypatch.setattr(news_scrapper.feedparser, "parse", mock_parse)
    
    # First run
    news_scrapper.scrape_spanish_mobility_news(target_month="2026-05")
    
    # Second run
    news_scrapper.scrape_spanish_mobility_news(target_month="2026-04")
    
    # Verify both months in metadata
    metadata = news_scrapper.load_scraper_metadata()
    assert "2026-05" in metadata["fetched_months"]
    assert "2026-04" in metadata["fetched_months"]
```

- [ ] **Step 3: Run all tests**

Run: `pytest tests/news_scraper_test.py -v`

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/news_scraper_test.py
git commit -m "test: add integration tests for monthly scraper"
```

---

## Task 7: Documentation and Final Testing

**Files:**
- Modify: `scripts/news_scrapper.py` (docstring update)

- [ ] **Step 1: Add CLI usage documentation as docstring**

Add a module-level docstring at the very top of `news_scrapper.py`:

```python
"""
Spanish Mobility News Scraper with Monthly Progressive Fetching

Usage:
  # Auto-detect and fetch next unfetched month
  python scripts/news_scrapper.py
  
  # Fetch specific month
  python scripts/news_scrapper.py --month 2026-04
  
  # Loop to fetch multiple months (with 2s delay between runs)
  while python scripts/news_scrapper.py; do sleep 2; done

Progress Tracking:
  Metadata is stored in data/news/scraper_metadata.json
  - fetched_months: List of successfully fetched months
  - failed_months: List of months that failed (can be retried)
  - oldest_target_month: Oldest month to attempt (default: 2023-05)
  - last_updated: Timestamp of last update

Each run waits 1.5s before returning to respect rate limits.
"""
```

- [ ] **Step 2: Run scraper once to create baseline metadata**

Run: `cd /Users/alvarodelser/Projects/BikesForCities-webapp && python scripts/news_scrapper.py`

Expected: 
- Scraper should run successfully
- `data/news/scraper_metadata.json` should be created
- At least 1 month should be in `fetched_months`
- Articles should be added to archive

- [ ] **Step 3: Run scraper again to verify auto-progression**

Run: `cd /Users/alvarodelser/Projects/BikesForCities-webapp && python scripts/news_scrapper.py`

Expected:
- Should detect next unfetched month
- `fetched_months` should now have 2 entries
- New articles from second month should be added

- [ ] **Step 4: Verify all tests still pass**

Run: `pytest tests/news_scraper_test.py -v`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "docs: add usage documentation for monthly scraper"
```

---

## Self-Review Against Spec

**Spec Coverage:**
- ✅ Monthly fetching with date range filtering (Task 3, 4)
- ✅ Metadata tracking of fetched months (Task 1, 5)
- ✅ On-demand execution (Task 4 main block)
- ✅ 3-year target (May 2023 to May 2026) (Task 2)
- ✅ 1-2s delays for rate limiting (Task 5)
- ✅ Error handling and failed month tracking (Task 5)
- ✅ Reuse of existing deduplication logic (unmodified in existing scraper)
- ✅ Backward compatibility (no month param defaults to current behavior)

**Placeholder Scan:**
- No TBDs, TODOs, or incomplete sections found
- All code blocks are complete and runnable
- All tests have explicit assertions
- All commands have expected outputs

**Type Consistency:**
- `month_str` format consistent: "YYYY-MM" throughout
- `metadata` dict structure consistent across all functions
- Return types explicit (None vs string vs dict)

**No Gaps Identified** — Spec is fully covered by implementation plan.
