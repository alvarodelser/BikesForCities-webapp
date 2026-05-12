# News Scraper Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Google News mobility scraper to deduplicate articles by URL and content similarity, merge them with multiple sources, and save output to an organized news folder.

**Architecture:** Enhance the existing `news_scrapper.py` script with deduplication logic. The scraper will fetch fresh news, compare against existing `data/news/movilidad_news.json`, detect duplicates by URL and content overlap, merge matching articles (multiple sources, earliest dates, aggregated topics), and save the deduplicated result. Each article gets a stable ID for consistency across runs.

**Tech Stack:** Python 3, feedparser, BeautifulSoup, JSON, difflib (for similarity matching)

---

## File Structure

```
data/
├── news/
│   └── movilidad_news.json          (migrated from data/movilidad_news.json)
│
scripts/
├── news_scrapper.py                 (enhanced with deduplication)
```

---

## Tasks

### Task 1: Create news folder and migrate existing data

**Files:**
- Create: `data/news/` (directory)
- Migrate: `data/movilidad_news.json` → `data/news/movilidad_news.json`

- [ ] **Step 1: Create the news directory**

```bash
mkdir -p /Users/alvarodelser/Projects/BikesForCities-webapp/data/news
```

- [ ] **Step 2: Copy existing JSON to new location**

```bash
cp /Users/alvarodelser/Projects/BikesForCities-webapp/data/movilidad_news.json /Users/alvarodelser/Projects/BikesForCities-webapp/data/news/movilidad_news.json
```

- [ ] **Step 3: Verify the file exists in new location**

```bash
ls -lh /Users/alvarodelser/Projects/BikesForCities-webapp/data/news/movilidad_news.json
```

Expected: File appears with size ~13KB

- [ ] **Step 4: Remove old file**

```bash
rm /Users/alvarodelser/Projects/BikesForCities-webapp/data/movilidad_news.json
```

- [ ] **Step 5: Commit migration**

```bash
git add data/news/movilidad_news.json
git rm data/movilidad_news.json
git commit -m "refactor: migrate movilidad_news.json to data/news/"
```

---

### Task 2: Add content similarity helper function

**Files:**
- Modify: `scripts/news_scrapper.py` (add function before `scrape_spanish_mobility_news()`)

- [ ] **Step 1: Add difflib import at top of file**

```python
import difflib
```

- [ ] **Step 2: Add similarity calculation function**

Insert this function before `scrape_spanish_mobility_news()`:

```python
def calculate_content_similarity(headline1, desc1, headline2, desc2):
    """
    Calculate word overlap similarity between two articles.
    Returns True if >80% of words overlap between combined headline+description.
    """
    # Normalize: lowercase and split into words, remove common words
    def get_unique_words(headline, description):
        text = f"{headline} {description}".lower()
        # Simple stop words to skip common articles/prepositions
        stop_words = {'el', 'la', 'de', 'en', 'y', 'a', 'los', 'las', 'del', 'por', 'con', 'al', 'un', 'una', 'o', 'para'}
        words = set(w for w in text.split() if w not in stop_words and len(w) > 2)
        return words
    
    words1 = get_unique_words(headline1, desc1)
    words2 = get_unique_words(headline2, desc2)
    
    if not words1 or not words2:
        return False
    
    # Calculate overlap percentage
    overlap = len(words1 & words2)
    total = len(words1 | words2)
    similarity = overlap / total if total > 0 else 0
    
    return similarity >= 0.8
```

- [ ] **Step 3: Run syntax check**

```bash
python3 -m py_compile /Users/alvarodelser/Projects/BikesForCities-webapp/scripts/news_scrapper.py
```

Expected: No output (syntax OK)

- [ ] **Step 4: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: add content similarity function for deduplication"
```

---

### Task 3: Add stable ID generation function

**Files:**
- Modify: `scripts/news_scrapper.py` (add function after similarity function)

- [ ] **Step 1: Add hashlib import at top**

```python
import hashlib
```

- [ ] **Step 2: Add stable ID function**

Insert this after `calculate_content_similarity()`:

```python
def generate_stable_id(headline):
    """
    Generate a stable hash-based ID from headline.
    Same headline always produces same ID across runs.
    """
    normalized = headline.lower().strip()
    hash_obj = hashlib.md5(normalized.encode())
    return hash_obj.hexdigest()[:12]  # Use first 12 chars of MD5
```

- [ ] **Step 3: Syntax check**

```bash
python3 -m py_compile /Users/alvarodelser/Projects/BikesForCities-webapp/scripts/news_scrapper.py
```

- [ ] **Step 4: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: add stable ID generation from headline hash"
```

---

### Task 4: Add article merge function

**Files:**
- Modify: `scripts/news_scrapper.py` (add function after ID function)

- [ ] **Step 1: Add merge function**

Insert this after `generate_stable_id()`:

```python
def merge_articles(existing_article, new_article):
    """
    Merge two duplicate articles into one.
    existing_article: article from file (dict)
    new_article: newly scraped article (dict)
    Returns merged article with multiple sources.
    """
    # Create sources array if not already present
    if "sources" not in existing_article:
        # Convert old format to new format
        existing_article["sources"] = [
            {
                "name": existing_article.get("source", "Unknown"),
                "link": existing_article.get("link", ""),
                "date": existing_article.get("publication_date", "")
            }
        ]
    
    # Add new source if not already present
    new_source = {
        "name": new_article.get("source", "Unknown"),
        "link": new_article.get("link", ""),
        "date": new_article.get("publication_date", "")
    }
    
    # Check if link already exists in sources
    existing_links = [s.get("link") for s in existing_article["sources"]]
    if new_source["link"] not in existing_links:
        existing_article["sources"].append(new_source)
    
    # Keep earliest publication date
    existing_date = existing_article.get("publication_date", "")
    new_date = new_article.get("publication_date", "")
    if new_date and (not existing_date or new_date < existing_date):
        existing_article["publication_date"] = new_date
    
    # Merge topics (union)
    existing_topics = set(existing_article.get("topics", []))
    new_topics = set(new_article.get("topics", []))
    existing_article["topics"] = sorted(list(existing_topics | new_topics))
    
    # Generate stable ID
    existing_article["id"] = generate_stable_id(existing_article.get("headline", ""))
    
    return existing_article
```

- [ ] **Step 2: Syntax check**

```bash
python3 -m py_compile /Users/alvarodelser/Projects/BikesForCities-webapp/scripts/news_scrapper.py
```

- [ ] **Step 3: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: add article merge function with multi-source support"
```

---

### Task 5: Add JSON loading function

**Files:**
- Modify: `scripts/news_scrapper.py` (add function after merge function)

- [ ] **Step 1: Add load function**

Insert this after `merge_articles()`:

```python
def load_existing_news():
    """
    Load existing news from data/news/movilidad_news.json.
    Returns list of articles, empty list if file doesn't exist.
    """
    import os
    import json
    
    file_path = "data/news/movilidad_news.json"
    
    if not os.path.exists(file_path):
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        print(f"Warning: Could not load {file_path}, starting fresh")
        return []
```

- [ ] **Step 2: Syntax check**

```bash
python3 -m py_compile /Users/alvarodelser/Projects/BikesForCities-webapp/scripts/news_scrapper.py
```

- [ ] **Step 3: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: add function to load existing news from file"
```

---

### Task 6: Add JSON saving function

**Files:**
- Modify: `scripts/news_scrapper.py` (add function after load function)

- [ ] **Step 1: Add save function**

Insert this after `load_existing_news()`:

```python
def save_news(articles):
    """
    Save articles to data/news/movilidad_news.json.
    Creates directory if it doesn't exist.
    """
    import os
    import json
    
    file_path = "data/news/movilidad_news.json"
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Saved {len(articles)} articles to {file_path}")
```

- [ ] **Step 2: Syntax check**

```bash
python3 -m py_compile /Users/alvarodelser/Projects/BikesForCities-webapp/scripts/news_scrapper.py
```

- [ ] **Step 3: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: add function to save news to JSON file"
```

---

### Task 7: Update scraper to deduplicate and merge

**Files:**
- Modify: `scripts/news_scrapper.py` - Replace the main scraper function and update main block

- [ ] **Step 1: Replace the scraper function**

Find and replace the `scrape_spanish_mobility_news()` function:

```python
def scrape_spanish_mobility_news(max_results=12):
    """
    Scrape Spanish mobility news from Google News RSS.
    Deduplicate against existing articles, merge duplicates.
    Save to data/news/movilidad_news.json
    """
    import json
    
    # 1. Define search query
    query = '"carril bici" OR "movilidad urbana"'
    encoded_query = urllib.parse.quote(query)
    
    # 2. Build Google News RSS URL
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=es&gl=ES&ceid=ES:es"
    
    # 3. Parse feed
    feed = feedparser.parse(rss_url)
    
    if not feed.entries:
        print("No new news found from RSS.")
        return
    
    # 4. Load existing articles
    existing_articles = load_existing_news()
    
    # 5. Process new articles
    print(f"\n--- Processing {len(feed.entries[:max_results])} new articles ---\n")
    
    new_articles = []
    for entry in feed.entries[:max_results]:
        title = entry.title.split(" - ")[0]  # Clean publisher name
        
        soup = BeautifulSoup(entry.summary, "html.parser")
        clean_text = soup.get_text(separator=" ")
        first_words = " ".join(clean_text.split()[:25]) + "..."
        
        new_article = {
            "headline": title,
            "description": first_words,
            "link": entry.link,
            "publication_date": entry.published,
            "source": entry.get('source', {}).get('title', 'Unknown'),
            "topics": []
        }
        
        # Check for URL match
        url_match_found = False
        for existing in existing_articles:
            # Check if URL is already in sources
            if "sources" in existing:
                existing_links = [s.get("link") for s in existing["sources"]]
            else:
                existing_links = [existing.get("link")]
            
            if new_article["link"] in existing_links:
                print(f"[URL MATCH] Merging: {title}")
                merge_articles(existing, new_article)
                url_match_found = True
                break
        
        if url_match_found:
            continue
        
        # Check for content similarity
        similarity_match_found = False
        for existing in existing_articles:
            existing_headline = existing.get("headline", "")
            existing_desc = existing.get("description", "")
            
            if calculate_content_similarity(
                title, 
                new_article["description"],
                existing_headline,
                existing_desc
            ):
                print(f"[SIMILARITY MATCH] Merging: {title} with {existing_headline}")
                merge_articles(existing, new_article)
                similarity_match_found = True
                break
        
        if not similarity_match_found:
            # New article, add to file
            print(f"[NEW] Adding: {title}")
            new_article["id"] = generate_stable_id(new_article["headline"])
            new_article["sources"] = [
                {
                    "name": new_article.get("source", "Unknown"),
                    "link": new_article.get("link", ""),
                    "date": new_article.get("publication_date", "")
                }
            ]
            existing_articles.append(new_article)
    
    # 6. Save deduplicated results
    save_news(existing_articles)
    print(f"\n--- Total articles in database: {len(existing_articles)} ---\n")
```

- [ ] **Step 2: Update the if __name__ == "__main__" block**

Replace the existing main block at the bottom:

```python
if __name__ == "__main__":
    scrape_spanish_mobility_news(max_results=12)
```

- [ ] **Step 3: Syntax check**

```bash
python3 -m py_compile /Users/alvarodelser/Projects/BikesForCities-webapp/scripts/news_scrapper.py
```

- [ ] **Step 4: Commit**

```bash
git add scripts/news_scrapper.py
git commit -m "feat: integrate deduplication and merging into main scraper"
```

---

### Task 8: Test the scraper with actual run

**Files:**
- Test: Run scraper manually

- [ ] **Step 1: Run the scraper**

```bash
cd /Users/alvarodelser/Projects/BikesForCities-webapp
python3 scripts/news_scrapper.py
```

Expected output:
```
--- Processing X new articles ---

[NEW/SIMILARITY MATCH/URL MATCH] Adding/Merging: [article titles]
✓ Saved N articles to data/news/movilidad_news.json
--- Total articles in database: N ---
```

- [ ] **Step 2: Verify JSON structure**

```bash
python3 << 'EOF'
import json
with open('data/news/movilidad_news.json', 'r') as f:
    articles = json.load(f)
    print(f"Total articles: {len(articles)}")
    first = articles[0]
    print(f"\nFirst article structure:")
    print(f"  - Has 'id': {'id' in first}")
    print(f"  - Has 'sources': {'sources' in first}")
    print(f"  - Has 'publication_date': {'publication_date' in first}")
    print(f"  - Has 'topics': {'topics' in first}")
    if 'sources' in first:
        print(f"  - Number of sources: {len(first['sources'])}")
        print(f"  - First source: {first['sources'][0]}")
EOF
```

Expected: All keys present, valid structure

- [ ] **Step 3: Run scraper again to test merge behavior**

```bash
python3 scripts/news_scrapper.py
```

Expected: Should detect some duplicates/matches and merge them, not duplicate articles

- [ ] **Step 4: Verify no duplicate URLs**

```bash
python3 << 'EOF'
import json
with open('data/news/movilidad_news.json', 'r') as f:
    articles = json.load(f)
    all_links = []
    for article in articles:
        if 'sources' in article:
            all_links.extend([s.get('link') for s in article['sources']])
        else:
            all_links.append(article.get('link'))
    
    unique_links = set(all_links)
    if len(all_links) == len(unique_links):
        print("✓ No duplicate URLs found")
    else:
        print(f"✗ Found {len(all_links) - len(unique_links)} duplicate URLs")
        # Find and print duplicates
        from collections import Counter
        counts = Counter(all_links)
        dups = [link for link, count in counts.items() if count > 1]
        for dup in dups:
            print(f"  Duplicate: {dup}")
EOF
```

Expected: "✓ No duplicate URLs found"

- [ ] **Step 5: Commit successful test**

```bash
git add data/news/movilidad_news.json
git commit -m "test: verify scraper deduplication and merge functionality"
```

---

### Task 9: Verify output structure matches spec

**Files:**
- Test: Validate against design spec

- [ ] **Step 1: Check a merged article has all required fields**

```bash
python3 << 'EOF'
import json
with open('data/news/movilidad_news.json', 'r') as f:
    articles = json.load(f)
    
    # Find an article with multiple sources (merged)
    merged = None
    for article in articles:
        if len(article.get('sources', [])) > 1:
            merged = article
            break
    
    if merged:
        print("✓ Found merged article:")
        print(f"  - ID: {merged.get('id')}")
        print(f"  - Headline: {merged.get('headline')[:50]}...")
        print(f"  - Sources: {len(merged.get('sources', []))}")
        for i, src in enumerate(merged['sources']):
            print(f"    {i+1}. {src['name']} - {src['date']}")
        print(f"  - Publication date (earliest): {merged.get('publication_date')}")
        print(f"  - Topics: {merged.get('topics')[:3]}...")
    else:
        print("No merged articles found yet (run scraper multiple times)")
EOF
```

Expected: Article with multiple sources displayed correctly

- [ ] **Step 2: Verify all articles have required fields**

```bash
python3 << 'EOF'
import json
with open('data/news/movilidad_news.json', 'r') as f:
    articles = json.load(f)
    required_fields = {'id', 'headline', 'description', 'sources', 'publication_date', 'topics'}
    
    missing_count = 0
    for i, article in enumerate(articles):
        missing = required_fields - set(article.keys())
        if missing:
            missing_count += 1
            print(f"Article {i} missing: {missing}")
    
    if missing_count == 0:
        print(f"✓ All {len(articles)} articles have required fields")
    else:
        print(f"✗ {missing_count} articles missing required fields")
EOF
```

Expected: "✓ All N articles have required fields"

- [ ] **Step 3: Commit successful verification**

```bash
git add -A
git commit -m "test: verify all articles match design spec structure"
```

---

## Spec Coverage Check

✓ **Folder migration** - Task 1 creates `data/news/` and migrates file  
✓ **JSON structure** - Tasks 2-7 implement new schema with id, sources array, publication_date, aggregated topics  
✓ **URL deduplication** - Task 7, Step 1 (URL match detection)  
✓ **Content similarity** - Task 2 (calculate_content_similarity function), Task 7 uses it  
✓ **Article merging** - Task 4 (merge_articles function), Task 7 applies it  
✓ **Stable ID generation** - Task 3 (generate_stable_id function)  
✓ **Multiple sources tracking** - Task 4 (sources array), Task 7 (adds sources)  
✓ **Earliest date preservation** - Task 4 (publication_date logic)  
✓ **Aggregated topics** - Task 4 (union of topics)  
✓ **Load/save** - Tasks 5-6 handle persistence  
✓ **Testing** - Task 8-9 verify functionality
