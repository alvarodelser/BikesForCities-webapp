# NLP Service Design

**Date:** 2026-05-16
**Status:** Draft
**Branch:** feat/forum

## Overview

Build a containerized FastAPI service that enriches scraped news articles with four independent NLP capabilities: summarization, geotagging, topic classification, and deduplication. The service is one piece of a larger news pipeline; the scraper framework and source-profiling notebooks are sibling sub-projects that will be specced separately.

The service is called per-article during scraping. The scraper owns Postgres I/O and the merge logic on duplicates; the NLP service is pure compute plus its own internal dedup state.

## Scope

**In scope (this spec):**

- A new top-level `nlp_service/` Python project deployed as a docker container
- A sibling `ollama` container hosting the LLM (default `gemma4:e2b`, swappable via `OLLAMA_MODEL` env var)
- Four POST endpoints — `/summarize`, `/geotag`, `/classify`, `/dedup-check` — plus housekeeping (`/dedup/bootstrap`, `/healthz`, `/readyz`)
- A scraper-side client at `backend/processing/news_enrich.py` that consumes the service and persists enriched rows
- LLM-rewritten headlines (publisher suffixes stripped, length-constrained) produced jointly with summaries via a single Ollama call with forced JSON output
- A schema migration that replaces flat `source/link` columns on `news` with a `sources JSONB` array, enabling duplicate-merge instead of duplicate-drop
- Four evaluation notebooks under `notebooks/nlp_eval/` measuring per-capability quality

**Out of scope (deferred to sibling specs or future work):**

- Scraper framework (`scrapper/` directory, source adapters beyond the existing Google News RSS, orchestrator notebook) — own spec
- Per-city / per-source profiling notebooks — own spec, depends on this one being stable
- Backfill / re-enrichment endpoints
- Authentication / rate limiting / metrics on the NLP service
- Street-level geocoding (we surface street mentions but do not resolve coordinates for them)
- Multilingual articles (Spanish only; English text will run but produce poor results)
- pytest / unit / integration / e2e test suites — evaluation notebooks are the only verification surface

## Architecture

### Top-level placement

```
BikesForCities-webapp/
├── backend/
│   └── processing/
│       └── news_enrich.py        (NEW — scraper-side client)
├── nlp_service/                  (NEW — top-level deployable)
│   ├── api/
│   │   ├── main.py               FastAPI app + lifespan
│   │   └── routers/
│   │       ├── summarize.py
│   │       ├── geotag.py
│   │       ├── classify.py
│   │       └── dedup.py
│   ├── nlp/
│   │   ├── summarizer/           textrank + ollama client
│   │   ├── geotagger/            spaCy + GeoNames + city-bounded disambiguation
│   │   ├── classifier/           NLI zero-shot
│   │   └── dedup/                MinHash LSH + FAISS
│   ├── config/topics.yaml
│   ├── scripts/
│   │   ├── build_geonames_es.py  build-time data prep
│   │   └── snapshot_cities.py    build-time data prep
│   ├── Dockerfile
│   ├── requirements.txt
│   └── docker-compose.yml        nlp-service + ollama services
├── backend/database/migrations/
│   └── 008_news_sources_jsonb.sql  (NEW)
└── notebooks/nlp_eval/           (NEW)
    ├── eval_summarizer.ipynb
    ├── eval_geotagger.ipynb
    ├── eval_classifier.ipynb
    ├── eval_dedup.ipynb
    └── scorecards/               dated CSV exports
```

### Container topology

Two containers on the shared `b4c-net` docker network.

| Container | Image base | Purpose |
|---|---|---|
| `nlp-service` | `python:3.11-slim` | FastAPI app, holds spaCy + NLI + MinHash + FAISS in-process |
| `ollama` | `ollama/ollama` | Hosts the LLM, used only by the summarizer; `--gpus all` if available |

`nlp-service` reaches `ollama` at `http://ollama:11434`. The scraper reaches `nlp-service` at `http://nlp-service:8000` (or `http://localhost:8000` when run on the host).

### State and volumes

| Volume | Mount | Contents |
|---|---|---|
| `nlp_dedup_data` | `/data/dedup/` | `faiss.index`, `minhash_lsh.pkl`, `id_map.json`, `state.json` |
| `ollama_models` | `/root/.ollama/` | Downloaded LLM weights |

spaCy `es_core_news_lg`, the NLI model, the GeoNames ES dump (filtered), and the cities snapshot are baked into the `nlp-service` image at build time — never on a volume. The image is reproducible and reproducibly sized.

### No DB access from `nlp-service`

The NLP service holds no psycopg dependency and no DB credentials. The scraper owns all Postgres I/O. Cold-rebuild of the dedup index is driven by the scraper calling `/dedup/bootstrap` with all known articles, not by the NLP service reaching into the DB.

## Schema migration

A new migration extends `news` to hold multiple sources per article, enabling the duplicate-merge flow.

```sql
-- backend/database/migrations/008_news_sources_jsonb.sql
ALTER TABLE news DROP COLUMN source;
ALTER TABLE news DROP COLUMN link;
ALTER TABLE news ADD COLUMN sources JSONB NOT NULL DEFAULT '[]';
CREATE INDEX idx_news_sources_gin ON news USING GIN (sources);
```

A row in `news` after this migration:

```json
{
  "id": "ef0b02f16268",
  "headline": "Las obras...",
  "summary": "Las obras en Irunlarrea...",
  "publication_dt": "2026-02-18",
  "topics": ["infraestructura", "carril bici"],
  "city": "Pamplona",
  "raw_txt": "Las obras de mejora medioambiental en la calle...",
  "sources": [
    {"name": "Ayuntamiento de Pamplona", "link": "https://...", "date": "2026-02-18"},
    {"name": "Diario de Navarra",         "link": "https://...", "date": "2026-02-19"}
  ]
}
```

`publication_dt` is always the oldest date among `sources[].date`. The GIN index enables fast `sources @> '[{"name": "BOE"}]'` queries for source-profiling work.

This migration must run before the scraper can call `enrich_and_persist` against an enrich-ready database.

## API surface

Four endpoints, all POST, all JSON. Each is independently usable — no order is enforced server-side.

### Common conventions

- All requests carry `article_id: str` (the scraper's stable hash, matches `news.id` once persisted)
- All requests carry `text: str` (the full article body, what becomes `news.raw_txt`)
- All responses echo `article_id` plus capability-specific payload
- Errors return HTTP 4xx for bad input, 5xx for internal failures; never a 200 with `error:` inside
- Stdout logs include `article_id` as a structured field

### `POST /summarize`

```jsonc
// Request
{
  "article_id": "ef0b02f16268",
  "text": "Las obras de mejora medioambiental...",
  "raw_headline": "Las obras... - rtpa.es",
  "max_sentences": 3
}

// Response
{
  "article_id": "ef0b02f16268",
  "headline": "Las obras en Irunlarrea reducen los accidentes a cero",
  "summary": "Las obras en Irunlarrea han reducido los accidentes a cero desde julio..."
}
```

This endpoint produces both fields in a single Ollama call. `raw_headline` is the scraper's untouched headline (often containing publisher suffixes like " - rtpa.es"); `headline` in the response is the clean rewrite. The scraper writes the rewritten `headline` into `news.headline` on insert.

Internal flow:

1. **Extractive gate.** If `text` is ≥ 500 tokens, run TextRank/LexRank to select top `max_sentences`. If shorter, skip extractive and pass full text — extractive doesn't help on short articles and can drop important context.
2. **LLM call.** Send the (possibly extracted) text plus `raw_headline` to Ollama using **forced JSON output** via the `format` parameter, with a schema demanding `{headline: string, summary: string}`. No regex on prose, no parse failures.
3. **Length validation.** Headline must be 8-15 words; summary must be 2-4 sentences. If out of bounds, regenerate once with a tightened prompt. After one retry, accept whatever comes back and log a warning.
4. **Return** both fields. If Ollama is unreachable after 3 retries, return 503 with `detail: "ollama_unavailable"`.

### `POST /geotag`

```jsonc
// Request
{
  "article_id": "ef0b02f16268",
  "text": "Las obras... en la calle Irunlarrea, entre las avenidas de Pío XII y Barañáin..."
}

// Response
{
  "article_id": "ef0b02f16268",
  "city": "Pamplona",
  "city_confidence": 0.87,
  "all_places": [
    {"text": "Irunlarrea", "type": "street", "lat": null, "lon": null},
    {"text": "Pío XII",    "type": "street", "lat": null, "lon": null},
    {"text": "Pamplona",   "type": "city",   "lat": 42.81, "lon": -1.64, "geonames_id": 3119992, "city_id": 7}
  ]
}
```

Internal flow:

1. spaCy `es_core_news_lg` over `text` → list of `LOC` / `GPE` / `FAC` spans
2. For each span, GeoNames lookup against an in-memory dict loaded from `data/geonames_es.tsv`
3. Disambiguation: filter to `feature_class = P` (populated places), match against the `cities_snapshot.json` baked into the image, score by `0.5 * frequency_in_text + 0.3 * population_normalized + 0.2 * appears_in_title`, take top
4. Only `city` (string) flows back to Postgres; `all_places` and `city_confidence` are response-only

If zero cities match: `city: null, city_confidence: 0.0`.

### `POST /classify`

```jsonc
// Request
{
  "article_id": "ef0b02f16268",
  "text": "Las obras..."
}

// Response
{
  "article_id": "ef0b02f16268",
  "topics": ["infraestructura", "carril bici", "presupuesto"],
  "scores": {
    "infraestructura": 0.91,
    "carril bici":     0.84,
    "presupuesto":     0.62,
    "accidente":       0.18
  }
}
```

Internal flow: load `config/topics.yaml` (lazy) → run `Recognai/bert-base-spanish-wwm-cased-xnli` zero-shot with the full label set → apply `score >= score_threshold AND top-k` filters. `topics` → `news.topics[]`; `scores` is response-only.

### `POST /dedup-check`

```jsonc
// Request
{
  "article_id": "ef0b02f16268",
  "text": "Las obras..."
}

// Response — duplicate found
{
  "article_id": "ef0b02f16268",
  "duplicate_of": "c1865cda5f3c",
  "stage": "minhash",
  "score": 0.93,
  "indexed": false
}

// Response — new article
{
  "article_id": "ef0b02f16268",
  "duplicate_of": null,
  "indexed": true
}
```

Internal flow (two-stage):

1. Compute MinHash signature → query LSH index. If best Jaccard ≥ `DEDUP_LSH_THRESHOLD` (default 0.9) → return as duplicate, do not add.
2. Otherwise, compute embedding via `paraphrase-multilingual-MiniLM-L12-v2` (384-dim) → query FAISS. If best cosine ≥ `DEDUP_EMBED_THRESHOLD` (default 0.85) → return as duplicate, do not add.
3. Otherwise, add to both indexes under `article_id`, persist incrementally to volume, return `duplicate_of: null, indexed: true`.

Thresholds are conservative — better to miss a duplicate than falsely merge two real articles.

### Housekeeping

- `POST /dedup/bootstrap` — iterates a list of `{article_id, text}`, rebuilds both indexes from scratch. Used on first ever boot or volume loss.
- `GET /healthz` — returns 200 always, does NOT trigger model loads (cheap orchestrator probe).
- `GET /readyz` — returns 200 only after at least one of each capability has been warm-loaded.

## Per-capability internals

Each capability is a standalone Python package under `nlp/` with this shape:

```
nlp/<capability>/
├── __init__.py     exports load() and run()
├── service.py      public interface used by the router
└── <internals>.py
```

The router in `api/routers/<capability>.py` does request validation → `service.run()` → response shaping. No NLP logic in routers.

### `nlp/summarizer/`

- **Stack:** `sumy` (TextRank/LexRank), `httpx` (Ollama client). No transformers dependency.
- **Files:** `service.py`, `extractive.py`, `ollama_client.py`, `validator.py`, `prompts/rewrite.es.txt`
- **Prompt template:** loaded once, formatted with `{max_sentences}`, `{raw_headline}`, and `{extract}`. Asks the LLM for a clean Spanish headline (8-15 words) plus a 2-4 sentence summary; warns the model that publisher suffixes in `raw_headline` should be stripped.
- **Extractive gate:** in `service.py`, count tokens (approximate via whitespace split). If `< 500`, skip `extractive.py` entirely and pass the full body. If `>= 500`, run TextRank for top `max_sentences`.
- **Ollama client:** uses `format` parameter with a JSON schema demanding `{headline: string, summary: string}`. 3 retries with exponential backoff on transport errors, 30s timeout per attempt.
- **Validator:** `validator.py` checks the parsed JSON — headline word count in `[8, 15]`, summary sentence count in `[2, 4]`. Out-of-bounds → regenerate once with a tightened prompt suffix. After the retry, accept and log.
- **Failure mode:** on Ollama 5xx after retries, return 503. On JSON-format failure after retries (model defied the schema), return 503 with `detail: "ollama_json_format_failed"` — no fallback to extractive-only.

### `nlp/geotagger/`

- **Stack:** `spacy` with `es_core_news_lg`. No external GeoNames library.
- **Files:** `service.py`, `ner.py`, `gazetteer.py`, `disambiguator.py`
- **Build-time data prep:**
  - `scripts/build_geonames_es.py` downloads `download.geonames.org/export/dump/ES.zip`, filters to populated places + first-order admin divisions, writes `geonames_es.tsv` (~5MB)
  - `scripts/snapshot_cities.py` connects to Postgres at image-build time (via `DATABASE_URL` build arg), queries `cities`, writes `cities_snapshot.json`
- **Known v1 limitation:** street-level mentions are surfaced in `all_places` but not geocoded

### `nlp/classifier/`

- **Stack:** `transformers` zero-shot pipeline with `Recognai/bert-base-spanish-wwm-cased-xnli`. CPU-only.
- **Files:** `service.py`, `taxonomy.py`, `model.py`
- **Topics YAML format:**

```yaml
labels:
  - infraestructura
  - carril bici
  - accidente
  - presupuesto
  - transporte público
  - movilidad sostenible
  - regulación
  - elecciones
  - evento ciudadano
  - contaminación
  # ~25 labels to start
multi_label: true
score_threshold: 0.5
top_k: 3
```

- Long articles truncate at 512 tokens. No chunk-and-aggregate in v1.

### `nlp/dedup/`

- **Stack:** `datasketch` (MinHash + LSH), `sentence-transformers`, `faiss-cpu`
- **Files:** `service.py`, `minhash_index.py`, `embedding_index.py`, `id_map.py`, `persistence.py`
- **MinHash config:** `threshold=0.9, num_perm=128`. Tokenization: 3-word shingles, accent-stripped, lowercased.
- **FAISS config:** `IndexFlatIP` (cosine via normalized inner product), 384-dim vectors
- **Persistence:**
  - Every 10 successful indexings: async `save_all()` to `/data/dedup/`
  - On `SIGTERM`: flush
  - Files written: `minhash_lsh.pkl`, `faiss.index`, `id_map.json`, `state.json`
- **Cold start:**
  1. Try to load all four files from `/data/dedup/`
  2. If `state.json` is missing OR `schema_version` mismatch: start empty, log warning
  3. Service is usable immediately as empty
  4. The scraper or operator is responsible for calling `/dedup/bootstrap` if a full rebuild is wanted

## Data flow

End-to-end path for one freshly scraped article:

```
                  ┌──────────────────────────┐
                  │  Scraper (Google News    │
                  │  RSS, BOE parser, etc.)  │
                  └────────────┬─────────────┘
                               │ raw {headline, body, link, source, pub_date}
                               ▼
                  ┌──────────────────────────┐
                  │  backend/processing/     │
                  │  news_enrich.py          │
                  │  (scraper-side client)   │
                  └────────────┬─────────────┘
                               │
                       /dedup-check
                               │
                ┌──────────────┴──────────────┐
                │                             │
           duplicate                      new article
                │                             │
                ▼                             ▼
        UPDATE news SET             /summarize  /geotag  /classify
          sources = sources           (concurrent fan-out;
            || $new_source,            /summarize returns BOTH
          publication_dt =             rewritten headline + summary)
            LEAST(publication_dt,                │
                  $new_date)                     ▼
        WHERE id = $dup_of               INSERT INTO news
        -- headline NOT updated:           (id, headline=<rewritten>,
        -- first-insert wins                summary, publication_dt,
                │                           topics, raw_txt, city, sources)
                ▼                                 │
       status="merged",                           ▼
       merged_into=$dup_of               status="inserted" or "partial"
```

### Ordering rules

1. **`/dedup-check` first, always, synchronous.** If duplicate, do not call other endpoints — no point burning cycles on a row we're not inserting.
2. **For non-duplicates,** fan out `/summarize` + `/geotag` + `/classify` concurrently via `httpx.AsyncClient`. `/summarize` returns both the rewritten `headline` and the `summary` from a single LLM call.
3. **On duplicate,** scraper UPDATEs the existing row to merge the new `(name, link, date)` source and set `publication_dt = LEAST(...)`. **The headline is NOT updated** — first-insert wins, per the "keep the original" rule.

### `backend/processing/news_enrich.py`

Public surface:

```python
@dataclass
class RawArticle:
    article_id: str       # sha1(normalized_headline)[:12]
    headline: str         # raw scraper headline — sent to /summarize as raw_headline
    body: str
    source_name: str
    source_link: str
    source_date: date

@dataclass
class EnrichResult:
    status: Literal["inserted", "merged", "partial", "failed"]
    news_id: int | None         # set for inserted/partial
    merged_into: str | None     # set for merged (the existing article_id)
    failures: list[str]         # endpoints that returned 5xx (partial only)
    reason: str | None          # set for failed

def enrich_and_persist(
    article: RawArticle,
    db_conn: Connection,
    nlp_base_url: str = "http://nlp-service:8000",
    timeout: float = 60.0,
    on_response: Callable[[str, dict], None] | None = None,
) -> EnrichResult: ...
```

Behavior:

- `/dedup-check` is called first, synchronously. Failure here is fatal (`status="failed"`).
- Duplicate → UPDATE existing row (merge source, set `publication_dt = LEAST(...)`, headline left untouched), return `status="merged"`.
- Non-duplicate → concurrent calls to `/summarize` (with `raw_headline=article.headline`), `/geotag`, `/classify`. Per-endpoint timeouts: 45s for summarize (LLM-bound, also produces the rewritten headline), 10s for the others.
- A 5xx on any of the three is non-fatal: that column becomes NULL in the INSERT, the failure is logged, status becomes `"partial"`. If `/summarize` fails, `headline` falls back to the scraper's raw headline (we still need *some* headline for the row).
- The INSERT writes the rewritten headline to `news.headline`, summary to `news.summary`, etc.
- The INSERT is wrapped in a single transaction.
- The optional `on_response` callback receives `(endpoint_name, raw_json_response)` per call — used by profiling notebooks to capture rich payloads (`all_places`, `scores`) without changing the function signature.

### Orchestrator usage

```python
# notebooks/news_enrich_run.ipynb (new)
from backend.processing.news_enrich import enrich_and_persist, RawArticle
from backend.processing.scrapers import google_news_rss

with get_db_conn() as conn:
    for raw in google_news_rss.fetch_new_since(last_run_ts):
        result = enrich_and_persist(raw, db_conn=conn)
        log.info(f"{raw.article_id}: {result.status}")
```

The notebook is the orchestrator. It picks the scraper, the timeframe, and reports a per-source summary at the end. Profiling notebooks pass an `on_response` callback that appends rich payloads to a Parquet file for analysis.

## Verification

There is no pytest suite. The four evaluation notebooks under `notebooks/nlp_eval/` are the only verification surface.

| Notebook | Measures | Output |
|---|---|---|
| `eval_summarizer.ipynb` | ROUGE-L vs ~30 hand-written reference summaries for body; separately, headline quality (word-count compliance + word-overlap-with-body floor as a hallucination proxy) | per-source/per-city score table for both fields |
| `eval_geotagger.ipynb` | Precision/recall on `city` over ~50 hand-labeled articles | per-city breakdown + confusion table |
| `eval_classifier.ipynb` | Per-label F1 over ~40 hand-labeled articles | confusion matrix |
| `eval_dedup.ipynb` | Precision/recall at each stage; threshold sensitivity sweep | scorecard + recommended thresholds |

Each notebook ends with a single-cell scorecard exported to `notebooks/nlp_eval/scorecards/YYYY-MM-DD-<capability>.csv`. The CSV trail gives longitudinal visibility into quality changes as prompts, models, and thresholds evolve.

Run manually. No CI hook, no pre-commit hook.

## Configuration

Environment variables read at startup (or first-use, for lazy components):

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_HOST` | `http://ollama:11434` | Ollama base URL |
| `OLLAMA_MODEL` | `gemma4:e2b` | Tag to use for summarization |
| `DEDUP_LSH_THRESHOLD` | `0.9` | MinHash Jaccard threshold for duplicate decision |
| `DEDUP_EMBED_THRESHOLD` | `0.85` | FAISS cosine threshold for duplicate decision |
| `DEDUP_PERSIST_EVERY_N` | `10` | Indexings between volume flushes |
| `DEDUP_DATA_DIR` | `/data/dedup` | Path to persistence volume mount |
| `NLP_LOG_LEVEL` | `INFO` | Standard Python logging level |

## Success criteria

- Scraper can POST a fresh article and either get back `merged_into=<existing_id>` or a new row inserted in `news`
- `news.sources` is a JSONB array; duplicates merged via `enrich_and_persist` correctly append the new source and set `publication_dt = LEAST(...)` while leaving `headline` untouched
- `/summarize` returns a structurally valid `{headline, summary}` JSON object on ≥ 99% of calls (forced-JSON output via Ollama `format` parameter)
- Rewritten headlines strip publisher suffixes (" - rtpa.es", " | Diario de Navarra", etc.) on ≥ 95% of cases in the eval set
- Cold-start of `nlp-service` with an existing `/data/dedup/` volume rebuilds indexes in under 2 seconds for a corpus of ≤ 1k articles
- `/dedup/bootstrap` rebuild from 421 existing articles (`movilidad_news_new.json`) completes in under 5 minutes on a CPU-only server
- All four evaluation notebooks run end-to-end and export scorecard CSVs

## Future work (explicitly deferred)

- Street-level geocoding in the geotagger
- Per-city / per-source topic taxonomies (replacing the single global YAML)
- Backfill / re-enrichment endpoint for already-persisted articles
- Authentication and rate limiting (when the service is exposed beyond the docker network)
- Prometheus metrics
- Scraper framework with multiple source adapters — own sibling spec
- Source-profiling notebook suite — own sibling spec, depends on this one
