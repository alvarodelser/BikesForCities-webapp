# News Scraper Expansion Design
**Date:** 2026-05-12  
**Status:** Approved

## Overview
Expand the Google News mobility scraper to deduplicate articles across multiple sources, merge them with aggregated metadata, and organize output in a dedicated news folder structure.

## Scope
- Move existing `data/movilidad_news.json` to `data/news/movilidad_news.json`
- Update JSON structure to support multiple sources per article
- Implement deduplication by URL and headline similarity
- Enhance scraper to merge articles, track multiple sources, and maintain earliest publication dates
- Preserve all current functionality and data

## Data Structure

### Current Structure
```json
{
  "headline": "Title",
  "description": "Summary",
  "link": "url",
  "publication_date": "2026-05-12",
  "source": "Source Name",
  "topics": ["tag1", "tag2"]
}
```

### New Structure
```json
{
  "id": "stable-hash-id",
  "headline": "Title",
  "description": "Summary",
  "sources": [
    {"name": "Source1", "link": "url1", "date": "2026-05-12"},
    {"name": "Source2", "link": "url2", "date": "2026-05-11"}
  ],
  "publication_date": "2026-05-11",
  "topics": ["merged", "tags", "from", "all", "sources"]
}
```

### Field Changes
- **id** (NEW): Stable hash-based identifier for deduplication across versions
- **sources** (NEW): Array of source objects with name, link, and publication date
- **publication_date**: Earliest date among all sources for the same article
- **topics**: Union of all topics from duplicate articles
- **link/source** (REMOVED): Replaced by sources array

## Deduplication Strategy

### Phase 1: URL Matching
- Check if article URL already exists in any article's sources array
- If found, merge into that article

### Phase 2: Headline Similarity
- For unmatched articles, compare headline similarity
- Simple word-overlap method: convert headlines to lowercase word sets, check if >80% of words overlap
- Can be expanded to Levenshtein distance or NLP-based similarity later
- Example: "carriles bici en madrid" vs "madrid añade carriles bici" → 3/4 words match → treated as duplicate

### Merge Logic
When duplicates are found:
- Keep original headline and description
- Add new source to sources array
- Set publication_date to earliest date
- Union all topics from both articles
- Generate stable ID from normalized headline

## Folder Structure
```
data/
├── news/
│   └── movilidad_news.json
└── [existing files]

scripts/
├── news_scrapper.py (enhanced)
└── [future: separate scrapers for other sources]
```

## Scraper Workflow

### Each Execution
1. Fetch fresh articles from Google News RSS (query: "carril bici" OR "movilidad urbana")
2. Load existing `data/news/movilidad_news.json` (if exists)
3. For each new article from RSS:
   - Check URL match in existing data → merge
   - Check headline similarity → merge if 80%+ match
   - If no match, add as new article
4. Generate/update stable IDs for all articles
5. Save deduplicated result to `data/news/movilidad_news.json`

### Output Guarantees
- No duplicate URLs across articles
- No duplicate articles by headline similarity
- All sources tracked with their original links and dates
- Article dates reflect earliest publication
- Topics are comprehensive (union of all sources)

## ID Generation
- Stable hash based on normalized headline (lowercase, whitespace normalized)
- Ensures same article gets same ID across scraper runs
- Regenerated on each run to handle merges

## Future Extensibility
- Additional scrapers (EMT, councils, RSS feeds) will output same JSON format
- Each scraper independently handles deduplication with existing file
- No unified scraper config needed; each source type gets own script

## Success Criteria
- ✅ Existing data migrated to new location with updated structure
- ✅ Scraper produces valid JSON with id, sources array, and aggregated metadata
- ✅ URL-based deduplication works (no duplicate links)
- ✅ Headline similarity detection merges ~80%+ matching articles
- ✅ Multiple sources tracked correctly
- ✅ Earliest dates preserved
- ✅ Topics properly aggregated
- ✅ Script runs without errors on repeated executions
