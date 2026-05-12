import feedparser
from bs4 import BeautifulSoup
import urllib.parse
import difflib
import hashlib

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

# Run the scraper
if __name__ == "__main__":
    scrape_spanish_mobility_news(max_results=12)