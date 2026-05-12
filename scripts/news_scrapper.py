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

def scrape_spanish_mobility_news(max_results=5):
    # 1. Define the search query targeted at Spain
    query = '"carril bici" OR "movilidad urbana"'
    encoded_query = urllib.parse.quote(query)
    
    # 2. Build the Google News RSS URL (Forcing Spanish language and Spain region)
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=es&gl=ES&ceid=ES:es"
    
    # 3. Parse the feed
    feed = feedparser.parse(rss_url)
    
    if not feed.entries:
        print("No news found.")
        return

    # 4. Extract and clean the data
    print(f"--- Top {max_results} Mobility News in Spain ---\n")
    for entry in feed.entries[:max_results]:
        title = entry.title.split(" - ")[0] # Cleans the publisher name from the title
        
        # Google News puts HTML in the summary. We use BeautifulSoup to extract just the text.
        soup = BeautifulSoup(entry.summary, "html.parser")
        clean_text = soup.get_text(separator=" ")
        
        # Grab the first ~25 words
        first_words = " ".join(clean_text.split()[:25]) + "..."
        
        print(f"Title: {title}")
        print(f"First Words: {first_words}")
        print("-" * 50)

# Run the scraper
if __name__ == "__main__":
    scrape_spanish_mobility_news(max_results=12)