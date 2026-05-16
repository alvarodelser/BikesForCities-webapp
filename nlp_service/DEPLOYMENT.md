# NLP Service — Deployment Checklist

Follow these steps in order the first time you deploy (or after a full reset).  
Steps marked **[user]** require you to run the command yourself — subagents / Claude Code do not touch DB or Docker.

---

## 1 · Prerequisites

| Tool | Minimum version | Check |
|------|-----------------|-------|
| Docker + Docker Compose | 24+ | `docker compose version` |
| Python | 3.11 | `python --version` |
| psql / DATABASE_URL | Postgres 15+ reachable | `psql "$DATABASE_URL" -c '\q'` |

Export your database URL once before running any scripts:

```bash
export DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

---

## 2 · Build geotagger data files  **[user]**

These files are generated from GeoNames and your DB and must be present before the Docker image can be built.

```bash
# Install the lightweight script deps (psycopg only)
pip install -r nlp_service/requirements-scripts.txt

# 2a. Download and filter GeoNames Spain TSV (~2 min, ~35 MB)
python nlp_service/scripts/build_geonames_es.py \
  --out nlp_service/nlp/geotagger/data/geonames_es.tsv

# 2b. Snapshot cities table from your Postgres DB
python nlp_service/scripts/snapshot_cities.py \
  --database-url "$DATABASE_URL" \
  --out nlp_service/nlp/geotagger/data/cities_snapshot.json
```

Verify:

```bash
wc -l nlp_service/nlp/geotagger/data/geonames_es.tsv   # expect > 20 000 lines
python -c "import json; d=json.load(open('nlp_service/nlp/geotagger/data/cities_snapshot.json')); print(len(d), 'cities')"
```

Commit the generated files:

```bash
git add nlp_service/nlp/geotagger/data/
git commit -m "chore: add geotagger data files"
```

---

## 3 · Build the Docker image  **[user]**

```bash
cd nlp_service
docker compose build
```

The build:
- installs Python deps (`requirements.txt`)
- downloads `es_core_news_lg` spaCy model (~600 MB)
- pulls NLTK punkt/stopwords
- pre-pulls the NLI model (`Recognai/bert-base-spanish-wwm-cased-xnli`)
- pre-pulls the embedding model (`paraphrase-multilingual-MiniLM-L12-v2`)
- runs a guard `RUN test -f ...` for all three required data/config files

Expected output ends with: `Successfully built` (no errors).

---

## 4 · Pull the Ollama model  **[user]**

Start Ollama and pull the summarisation model before the NLP service tries to use it.

```bash
# Start only the Ollama sidecar
docker compose up -d ollama

# Pull the model (gemma4:e2b is the default; override with OLLAMA_MODEL env var)
docker exec ollama ollama pull gemma4:e2b

# Confirm the model is listed
docker exec ollama ollama list
```

---

## 5 · Start the NLP service  **[user]**

```bash
docker compose up -d nlp-service
```

Watch startup logs:

```bash
docker logs -f nlp-service
```

Expected log lines (in order):

```
nlp-service starting up
INFO     nlp_service ... spaCy model loaded
INFO     nlp_service ... classifier pipeline loaded
INFO     nlp_service ... dedup indexes loaded
```

The service is bound to **http://localhost:8001**.

---

## 6 · Health and readiness checks  **[user]**

```bash
# Liveness (always returns 200 once the process is up)
curl -s http://localhost:8001/healthz | jq .
# → {"status":"ok"}

# Readiness (returns 503 while models are warming, 200 when ready)
until curl -sf http://localhost:8001/readyz > /dev/null; do
  echo "warming…"; sleep 5
done
echo "ready"
```

`/readyz` checks that all four capabilities (`summarize`, `geotag`, `classify`, `dedup`) have been warmed.  
Warm-up happens automatically on the first POST to each endpoint **or** via Step 7.

---

## 7 · Smoke-test each capability  **[user]**

Run these one at a time to force warm-up and confirm each capability responds correctly.

### 7a · Summarize

```bash
curl -s -X POST http://localhost:8001/summarize \
  -H 'Content-Type: application/json' \
  -d '{
    "article_id": "smoke-1",
    "text": "El Ayuntamiento de Madrid ha aprobado la ampliación del carril bici en el centro. La nueva infraestructura conectará los barrios de Malasaña y Lavapiés. Las obras comenzarán el próximo mes y durarán tres semanas.",
    "raw_headline": "Madrid amplía el carril bici"
  }' | jq .
```

Expected: `headline` and `summary` fields populated, no `500`.

### 7b · Geotag

```bash
curl -s -X POST http://localhost:8001/geotag \
  -H 'Content-Type: application/json' \
  -d '{
    "article_id": "smoke-2",
    "text": "El carril bici de la Gran Vía de Madrid llega hasta Cibeles.",
    "headline": "Nuevo carril bici en Gran Vía"
  }' | jq .
```

Expected: `city` = `"Madrid"`, `city_confidence` > 0, `all_places` non-empty.

### 7c · Classify — in-scope

```bash
curl -s -X POST http://localhost:8001/classify \
  -H 'Content-Type: application/json' \
  -d '{
    "article_id": "smoke-3",
    "text": "La nueva zona de bajas emisiones de Barcelona reduce el tráfico en un 20%. Los carriles bici han aumentado un 15% en el último año."
  }' | jq .
```

Expected: `out_of_scope` = `false`, `topics` contains at least one label.

### 7d · Classify — out-of-scope rejection

```bash
curl -s -X POST http://localhost:8001/classify \
  -H 'Content-Type: application/json' \
  -d '{
    "article_id": "smoke-4",
    "text": "El equipo ciclista Movistar ganó la Vuelta a España con una diferencia de dos minutos sobre el segundo clasificado."
  }' | jq .
```

Expected: `out_of_scope` = `true`, `topics` = `[]`.

### 7e · Dedup — new article

```bash
curl -s -X POST http://localhost:8001/dedup/check \
  -H 'Content-Type: application/json' \
  -d '{
    "article_id": "smoke-5",
    "text": "Madrid aprueba un nuevo carril bici en la calle Alcalá para mejorar la movilidad sostenible."
  }' | jq .
```

Expected: `duplicate_of` = `null`, `indexed` = `true`.

### 7f · Dedup — duplicate detection

```bash
curl -s -X POST http://localhost:8001/dedup/check \
  -H 'Content-Type: application/json' \
  -d '{
    "article_id": "smoke-5b",
    "text": "Madrid aprueba un nuevo carril bici en la calle Alcalá para mejorar la movilidad sostenible."
  }' | jq .
```

Expected: `duplicate_of` = `"smoke-5"`, `indexed` = `false`.

---

## 8 · Verify with evaluation notebooks

With the service running, open and run each notebook from top to bottom.  
Each notebook prints a scorecard — check the **threshold guidance** cell at the end.

| Notebook | What it tests | Key metric |
|----------|--------------|------------|
| `eval/01_summarize_eval.ipynb` | Summary quality (ROUGE-1 ≥ 0.25, readability) | ROUGE-1 F |
| `eval/02_geotag_eval.ipynb` | City detection precision/recall | Precision ≥ 0.85 |
| `eval/03_classify_eval.ipynb` | Topic labels + out-of-scope rejection | F1 ≥ 0.70, rejection recall = 1.0 |
| `eval/04_dedup_eval.ipynb` | MinHash + embedding duplicate detection | Recall ≥ 0.90 |

If a metric is below target, follow the **Tuning** section inside the relevant notebook.

---

## 9 · Environment variables reference

| Variable | Default | Effect |
|----------|---------|--------|
| `OLLAMA_HOST` | `http://ollama:11434` | Ollama sidecar URL |
| `OLLAMA_MODEL` | `gemma4:e2b` | LLM model for summarisation rewrite |
| `OLLAMA_TIMEOUT` | `30` | Seconds before Ollama call times out |
| `TOPICS_YAML_PATH` | `/app/config/topics.yaml` | Path to classifier taxonomy |
| `DEDUP_LSH_THRESHOLD` | `0.9` | MinHash Jaccard threshold |
| `DEDUP_EMBED_THRESHOLD` | `0.85` | Cosine similarity threshold |
| `DEDUP_PERSIST_EVERY_N` | `10` | Flush dedup state every N indexings |
| `DEDUP_DATA_DIR` | `/data/dedup` | Volume mount for dedup persistence |
| `NLP_LOG_LEVEL` | `INFO` | Python logging level |

---

## 10 · Resetting dedup state  **[user]**

If you need to rebuild the dedup indexes from scratch (e.g. after truncating the `articles` table):

```bash
# 1. Stop the service
docker compose stop nlp-service

# 2. Remove the dedup volume
docker volume rm nlp_service_nlp_dedup_data

# 3. Restart
docker compose up -d nlp-service

# 4. Bootstrap from existing articles (adjust the query/URL as needed)
curl -s -X POST http://localhost:8001/dedup/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{"articles": []}' | jq .
```

Or use the bootstrap endpoint with a list of `{article_id, text}` objects fetched from your DB.
