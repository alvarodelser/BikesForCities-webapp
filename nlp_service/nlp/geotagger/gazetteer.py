# nlp_service/nlp/geotagger/gazetteer.py
import csv
import unicodedata
from dataclasses import dataclass
from pathlib import Path

_DATA_PATH = Path(__file__).parent / "data" / "geonames_es.tsv"
_entries: dict[str, list["GeoEntry"]] = {}


@dataclass
class GeoEntry:
    geonames_id: int
    name: str
    lat: float
    lon: float
    feature_class: str
    feature_code: str
    admin1_code: str
    population: int


def _normalize(s: str) -> str:
    s = s.lower()
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def load() -> None:
    if _entries:
        return
    with _DATA_PATH.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            try:
                e = GeoEntry(
                    geonames_id=int(row["geonames_id"]),
                    name=row["name"],
                    lat=float(row["lat"]),
                    lon=float(row["lon"]),
                    feature_class=row["feature_class"],
                    feature_code=row["feature_code"],
                    admin1_code=row["admin1_code"],
                    population=int(row["population"] or 0),
                )
            except (ValueError, KeyError):
                continue
            for key in {_normalize(row["name"]), _normalize(row["asciiname"])}:
                _entries.setdefault(key, []).append(e)


def lookup(span_text: str) -> list[GeoEntry]:
    load()
    return _entries.get(_normalize(span_text), [])
