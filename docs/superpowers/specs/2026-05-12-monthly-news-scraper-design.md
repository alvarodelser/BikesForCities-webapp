# Monthly Progressive News Scraper Design

**Date:** 2026-05-12  
**Scope:** Expand news scraper to fetch articles retrospectively by month without hitting API limits

## Problem Statement

Current scraper fetches only the first 400 articles from multiple queries, limiting historical coverage. Goal: progressively fetch all Spanish mobility news from the past 3 years (May 2023 to May 2026) by breaking requests into monthly chunks, tracking progress, and respecting rate limits.

## Solution Overview

Implement a monthly progressive scraper that:
- Fetches articles one month at a time (working backwards)
- Tracks fetched months in `scraper_metadata.json`
- Reuses existing deduplication logic
- Executes on-demand with 1-2s delays between months
- Targets completion: ~36 months × on-demand runs = full coverage over time

## Architecture

### Data Files

1. **`data/news/scraper_metadata.json`** (new)
   - Tracks progress of historical fetching
   - Schema:
     ```json
     {
       "fetched_months": ["2026-05", "2026-04", "2026-03"],
       "failed_months": ["2026-02"],
       "oldest_target_month": "2023-05",
       "last_updated": "2026-05-12T14:30:00Z"
     }
     ```

2. **`data/news/movilidad_news.json`** (existing)
   - Archive of all articles (deduplicated, merged across sources)
   - Expanded over time as new months are fetched

3. **`data/news/movilidad_news_new.json`** (existing)
   - Only newly discovered articles from the latest run
   - Cleared and regenerated each scrape

### Core Functions

#### `load_scraper_metadata()`
- Loads `scraper_metadata.json`
- Returns dict with `fetched_months`, `failed_months`, `oldest_target_month`
- Returns empty structure if file doesn't exist (first run)

#### `save_scraper_metadata(metadata)`
- Writes metadata to `scraper_metadata.json`
- Includes timestamp of update

#### `get_next_unfetched_month()`
- Reads metadata
- Returns next month to fetch (working backwards from May 2026 to May 2023)
- Returns None if all months fetched or error

#### `scrape_spanish_mobility_news(max_results=100, target_month=None, delay_seconds=1.5)`
- **Modified signature:** adds optional `target_month` (e.g., "2026-04") and `delay_seconds` params
- If `target_month` provided: filter queries by date range (`after:YYYY-MM-01 before:YYYY-MM-31`)
- If not provided: fetch current/recent articles (backward compatible)
- Reuses all existing deduplication/merge logic
- On success: updates metadata with fetched month
- On failure: logs error, records in `failed_months`, does not block future runs
- Sleeps `delay_seconds` before returning (throttle for rate limits)

### Execution Patterns

**On-demand single month fetch:**
```
$ python news_scrapper.py  # Fetches next unfetched month automatically
```

**Fetch specific month:**
```
$ python news_scrapper.py --month 2026-03  # Fetch March 2026
```

**Fetch all remaining (loop externally):**
```bash
while python scripts/news_scrapper.py; do sleep 2; done
```

## Data Flow

1. **User runs scraper (on-demand)**
2. Load metadata → determine next unfetched month (e.g., "2026-04")
3. Query Google News with 10 search terms + date filter for April 2026
4. Collect all entries from RSS feeds
5. Load existing archive
6. Deduplicate by URL, then by content similarity
7. Merge duplicate sources
8. Save updated archive + new articles
9. Update metadata: add "2026-04" to `fetched_months`
10. Wait 1-2s
11. Return to user

## Rate Limiting & Error Handling

### Rate Limiting
- 1-2s delay between months prevents rapid-fire requests to Google News
- No parallel fetches (single-threaded, on-demand execution)
- Each run fetches one month, so user controls pace

### Error Handling
- **Empty month:** Log as success (no articles published that month)
- **Network error:** Log failure, record month in `failed_months`, continue
- **Malformed RSS:** Skip problematic feed, continue with others
- **Failed month:** User can retry manually; `failed_months` helps identify problematic periods

## Success Criteria

- ✅ Scraper fetches one month per run without hitting API limits
- ✅ Progress tracked in metadata (resumable, can pause/resume)
- ✅ All existing deduplication logic preserved and reused
- ✅ Backward compatible (can still fetch recent articles without month param)
- ✅ Articles from 3 years back successfully ingested into archive
- ✅ No manual intervention needed between runs (automatic month progression)

## Testing Plan

1. **Unit tests:**
   - `load_scraper_metadata()` with existing and missing file
   - `get_next_unfetched_month()` progression logic
   - Date range query construction for each month

2. **Integration tests:**
   - Single month fetch (verify articles saved, metadata updated)
   - Sequential runs (verify progression backwards)
   - Deduplication still works across months
   - Failed month handling (simulate network error, verify continued progress)

3. **Manual validation:**
   - Run on-demand once, verify metadata and article count
   - Run again, verify next month fetched
   - Check article publication dates span full month window

## Open Questions

None — design is complete and approved.
