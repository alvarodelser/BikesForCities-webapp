-- Migration 018: enable pg_trgm for fuzzy street-name search.
-- Used by search_edges_by_name() to rank results by trigram similarity.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
