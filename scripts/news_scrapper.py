import feedparser
from bs4 import BeautifulSoup
import urllib.parse
import difflib

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