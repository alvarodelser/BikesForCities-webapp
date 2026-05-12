CREATE TABLE IF NOT EXISTS news (
    id             SERIAL PRIMARY KEY,
    headline       TEXT NOT NULL,
    summary        TEXT,
    link           TEXT,
    source         TEXT,
    publication_dt DATE,
    topics         TEXT[],
    raw_txt        TEXT,
    city           TEXT,
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_publication_dt ON news(publication_dt);
CREATE INDEX IF NOT EXISTS idx_news_city ON news(city);
