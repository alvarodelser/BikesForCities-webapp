#!/usr/bin/env python3
# nlp_service/scripts/snapshot_streets.py
"""
Snapshot the `edges` table into a street_index.json the NLP container can read
without a live DB connection.

Usage:
    python scripts/snapshot_streets.py \
        --database-url "$DATABASE_URL" \
        --out config/street_index.json

Street index shape:
    {"<city_id>": {"<normalized_name>": [edge_id, ...]}}

Normalization: lowercase, strip accents, strip leading street-type prefix.
"""
import argparse
import json
import logging
import os
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import psycopg

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("snapshot_streets")

_PREFIX_RE = re.compile(
    r'^(?:calle|avda?\.?|avenida|plaza|pza\.?|paseo|ps\.?|'
    r'glorieta|ronda|c/|camino|carretera|ctra\.?)\s+',
    re.IGNORECASE,
)


def _normalize(s: str) -> str:
    s = s.lower()
    s = "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )
    s = _PREFIX_RE.sub("", s).strip()
    return s


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")

    args.out.parent.mkdir(parents=True, exist_ok=True)

    index: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))

    with psycopg.connect(args.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT id, city_id, name FROM edges WHERE name IS NOT NULL AND name <> '' ORDER BY city_id"
        )
        for edge_id, city_id, name in cur.fetchall():
            norm = _normalize(name)
            if norm:
                index[str(city_id)][norm].append(edge_id)

    # Convert defaultdicts to plain dicts for JSON serialization
    out = {cid: dict(streets) for cid, streets in index.items()}
    args.out.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    total_streets = sum(len(v) for v in out.values())
    log.info("wrote %d cities, %d unique street names to %s",
             len(out), total_streets, args.out)


if __name__ == "__main__":
    main()
