import feedparser
from bs4 import BeautifulSoup
import urllib.parse
import hashlib
import json
import os
from datetime import datetime, timedelta

def get_month_date_filters(month_str):
    """
    Generate date filters for Google News RSS query.
    Input: "2026-04" (YYYY-MM)
    Returns tuple: (after_date, before_date) as "YYYY-MM-DD" strings
    Example: ("2026-04-01", "2026-04-30")
    """
    if not month_str or len(month_str) != 7 or month_str[4] != '-':
        raise ValueError(f"Invalid month format: '{month_str}'. Expected YYYY-MM")

    year = int(month_str[:4])
    month = int(month_str[5:7])

    if not (1 <= month <= 12):
        raise ValueError(f"Invalid month: {month}. Must be 1-12")

    # First day of month
    after_date = f"{year:04d}-{month:02d}-01"

    # Last day of month (next month's first day - 1)
    if month == 12:
        next_month = 1
        next_year = year + 1
    else:
        next_month = month + 1
        next_year = year

    last_day = datetime(next_year, next_month, 1) - timedelta(days=1)
    before_date = last_day.strftime("%Y-%m-%d")

    return (after_date, before_date)

def build_rss_url_with_date_filter(query, after_date=None, before_date=None):
    """
    Build Google News RSS URL with optional date filters.
    If after_date/before_date provided, adds to query: "query after:DATE before:DATE"
    Both dates must be provided together or neither should be provided.
    """
    if (after_date is None) != (before_date is None):
        raise ValueError("Both after_date and before_date must be provided together, or neither")

    if after_date and before_date:
        query = f"{query} after:{after_date} before:{before_date}"

    encoded_query = urllib.parse.quote(query)
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=es&gl=ES&ceid=ES:es"
    return rss_url

def load_scraper_metadata(base_path="data/news"):
    """
    Load scraper metadata tracking which months have been fetched.
    Returns dict with fetched_months, failed_months, oldest_target_month, last_updated.
    """
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

def save_scraper_metadata(metadata, base_path="data/news"):
    """
    Save scraper metadata to data/news/scraper_metadata.json.
    Updates last_updated timestamp.
    """
    metadata["last_updated"] = datetime.utcnow().isoformat() + "Z"

    metadata_path = os.path.join(base_path, "scraper_metadata.json")
    os.makedirs(base_path, exist_ok=True)

    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print(f"✓ Metadata saved: {len(metadata['fetched_months'])} months fetched")

def get_next_unfetched_month(metadata):
    """
    Determine next month to fetch, working backwards from May 2026 to oldest_target_month.
    Returns month string (e.g., "2026-04") or None if all months complete.
    """
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

def generate_stable_id(headline):
    """
    Generate a stable hash-based ID from headline.
    Same headline always produces same ID across runs.
    """
    normalized = headline.lower().strip()
    hash_obj = hashlib.md5(normalized.encode())
    return hash_obj.hexdigest()[:12]  # Use first 12 chars of MD5

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

def load_existing_news():
    """
    Load existing news from data/news/movilidad_news.json.
    Converts old format to new format with 'id' and 'sources' fields.
    Returns list of articles, empty list if file doesn't exist.
    """
    import os
    import json

    file_path = "data/news/movilidad_news.json"

    if not os.path.exists(file_path):
        return []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            articles = json.load(f)

        # Convert old format to new format
        for article in articles:
            # Add 'id' field if missing
            if "id" not in article:
                article["id"] = generate_stable_id(article.get("headline", ""))

            # Convert 'link' and 'source' to 'sources' array if needed
            if "sources" not in article and "link" in article:
                article["sources"] = [
                    {
                        "name": article.get("source", "Unknown"),
                        "link": article.get("link", ""),
                        "date": article.get("publication_date", "")
                    }
                ]

        return articles
    except (json.JSONDecodeError, IOError):
        print(f"Warning: Could not load {file_path}, starting fresh")
        return []

def save_news(articles, filename="movilidad_news.json"):
    """
    Save articles to data/news/{filename}.
    Creates directory if it doesn't exist.
    """
    import os
    import json

    file_path = f"data/news/{filename}"

    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print(f"✓ Saved {len(articles)} articles to {file_path}")

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
    import json

    # 1. Define search queries (multiple to get comprehensive coverage)
    queries = [
        'carril bici',
        'movilidad urbana',
        'bicicleta España',
        'infraestructura ciclista',
        'ciclovía',
        'transporte sostenible',
        'movilidad sostenible',
        'bike sharing',
        'bicicleta eléctrica',
        'transporte urbano'
    ]

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

    feed_entries = all_entries

    if not all_entries:
        print("No new news found from RSS.")
        return

    # 3. Load existing articles
    archive_articles = load_existing_news()

    # 4. Process new articles
    newly_discovered = []
    articles_to_process = min(len(all_entries), max_results)
    print(f"\n--- Processing {articles_to_process} articles from {len(all_entries)} total ---\n")

    for entry in all_entries[:articles_to_process]:
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
        for existing in archive_articles:
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
        for existing in archive_articles:
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
            # New article - add to both archive and new list
            print(f"[NEW] Adding: {title}")
            new_article["id"] = generate_stable_id(new_article["headline"])
            new_article["sources"] = [
                {
                    "name": new_article.get("source", "Unknown"),
                    "link": new_article.get("link", ""),
                    "date": new_article.get("publication_date", "")
                }
            ]
            archive_articles.append(new_article)
            newly_discovered.append(new_article)

    # 6. Save archive (all articles including merged)
    save_news(archive_articles, "movilidad_news.json")

    # 7. Save newly discovered articles separately
    if newly_discovered:
        save_news(newly_discovered, "movilidad_news_new.json")
        print(f"\n✓ Found {len(newly_discovered)} NEW articles")
    else:
        print(f"\n✓ No new articles found (all were duplicates/merged)")

    print(f"--- Total articles in archive: {len(archive_articles)} ---\n")

    # Final delay for rate limiting
    import time
    time.sleep(delay_seconds)

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