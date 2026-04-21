import feedparser
from bs4 import BeautifulSoup
import urllib.parse

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