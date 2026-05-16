FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# spaCy Spanish model (~600MB)
RUN python -m spacy download es_core_news_lg

# NLTK stopwords for sumy
RUN python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('stopwords', quiet=True)"

# Pre-pull NLI + embedding models so first request is fast
RUN python -c "from transformers import pipeline; pipeline('zero-shot-classification', model='Recognai/bert-base-spanish-wwm-cased-xnli')"
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

COPY . /app/

# Explicit guard: fail the build if geotagger data files are missing.
RUN test -f /app/nlp/geotagger/data/geonames_es.tsv && \
    test -f /app/nlp/geotagger/data/cities_snapshot.json

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
