#!/usr/bin/env python3
# nlp_service/scripts/snapshot_cities.py
"""
Snapshot the `cities` table into a JSON file the NLP container can read
without a DB connection. Output is committed to the repo.

Usage:
    python scripts/snapshot_cities.py \
        --database-url "$DATABASE_URL" \
        --out nlp/geotagger/data/cities_snapshot.json
"""
import argparse
import json
import logging
import os
from pathlib import Path

import psycopg

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("snapshot_cities")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")

    args.out.parent.mkdir(parents=True, exist_ok=True)

    rows: list[dict] = []
    with psycopg.connect(args.database_url) as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, alt_name, slug, center_lat, center_lon,
                   population, wikidata_id,
                   bounds_min_lat, bounds_max_lat,
                   bounds_min_lon, bounds_max_lon
            FROM cities
            ORDER BY id
        """)
        cols = [c.name for c in cur.description]
        for r in cur.fetchall():
            rows.append(dict(zip(cols, r)))

    args.out.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str),
                        encoding="utf-8")
    log.info("wrote %d cities to %s", len(rows), args.out)


if __name__ == "__main__":
    main()
