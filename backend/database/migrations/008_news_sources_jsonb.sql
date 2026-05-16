-- backend/database/migrations/008_news_sources_jsonb.sql
ALTER TABLE news DROP COLUMN IF EXISTS source;
ALTER TABLE news DROP COLUMN IF EXISTS link;
ALTER TABLE news ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_news_sources_gin ON news USING GIN (sources);
