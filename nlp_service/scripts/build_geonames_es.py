#!/usr/bin/env python3
# nlp_service/scripts/build_geonames_es.py
"""
Download GeoNames ES dump, filter to populated places + admin divisions,
write a tab-separated file ready to be loaded into an in-memory dict.

Usage:
    python scripts/build_geonames_es.py \
        --url https://download.geonames.org/export/dump/ES.zip \
        --out nlp/geotagger/data/geonames_es.tsv

This is a host-side tool. Output is committed to the repo so the image
build is deterministic and offline.
"""
import argparse
import csv
import io
import logging
import urllib.request
import zipfile
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("build_geonames_es")

# GeoNames columns we keep. Full schema:
# https://download.geonames.org/export/dump/readme.txt
COLS_OUT = [
    "geonames_id", "name", "asciiname", "lat", "lon",
    "feature_class", "feature_code", "country_code",
    "admin1_code", "population",
]

KEEP_CLASSES = {"P", "A"}  # P = populated place, A = admin division


def filter_dump(zf: zipfile.ZipFile, out_path: Path) -> int:
    with zf.open("ES.txt") as fin:
        text = io.TextIOWrapper(fin, encoding="utf-8", newline="")
        reader = csv.reader(text, delimiter="\t")
        with out_path.open("w", encoding="utf-8", newline="") as fout:
            writer = csv.writer(fout, delimiter="\t")
            writer.writerow(COLS_OUT)
            count = 0
            for row in reader:
                # GeoNames dump columns (0-indexed):
                # 0=id 1=name 2=asciiname 3=alternates 4=lat 5=lon
                # 6=feature_class 7=feature_code 8=country 10=admin1
                # 14=population
                if len(row) < 15:
                    continue
                feature_class = row[6]
                if feature_class not in KEEP_CLASSES:
                    continue
                writer.writerow([
                    row[0], row[1], row[2], row[4], row[5],
                    row[6], row[7], row[8], row[10], row[14],
                ])
                count += 1
            return count


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="https://download.geonames.org/export/dump/ES.zip")
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()

    if not args.url.startswith("https://"):
        raise SystemExit("--url must use HTTPS")

    args.out.parent.mkdir(parents=True, exist_ok=True)

    log.info("downloading %s", args.url)
    with urllib.request.urlopen(args.url, timeout=60) as resp:
        # Full read required: ZipFile needs a seekable stream (BytesIO wraps bytes).
        zip_bytes = resp.read()

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        count = filter_dump(zf, args.out)

    log.info("wrote %d rows to %s", count, args.out)


if __name__ == "__main__":
    main()
