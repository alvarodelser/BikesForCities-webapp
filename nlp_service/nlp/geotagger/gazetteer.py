# nlp_service/nlp/geotagger/gazetteer.py
from __future__ import annotations

import csv
import json
import os
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

_STREET_PREFIX_RE = re.compile(
    r'^(?:calle|avda?\.?|avenida|plaza|pza\.?|paseo|ps\.?|'
    r'glorieta|ronda|c/|camino|carretera|ctra\.?)\s+',
    re.IGNORECASE,
)

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


_STREET_INDEX_PATH = Path(os.environ.get(
    "STREET_INDEX_PATH",
    Path(__file__).parent.parent.parent / "config" / "street_index.json",
))
_SOURCE_PRIOR_PATH = Path(os.environ.get(
    "SOURCE_PRIOR_PATH",
    Path(__file__).parent.parent.parent / "config" / "source_city_prior.json",
))

_street_index: dict[str, dict[str, list[int]]] = {}   # {city_id_str: {norm_name: [edge_ids]}}
_source_prior: dict = {}                               # {source_name: city_id or None}


def load_streets() -> None:
    global _street_index
    if _street_index:
        return
    if _STREET_INDEX_PATH.exists():
        _street_index = json.loads(_STREET_INDEX_PATH.read_text(encoding="utf-8"))


def load_source_prior() -> None:
    global _source_prior
    if _source_prior:
        return
    if _SOURCE_PRIOR_PATH.exists():
        _source_prior = json.loads(_SOURCE_PRIOR_PATH.read_text(encoding="utf-8"))


def _normalize_street(s: str) -> str:
    """Normalize a street span: lowercase, strip accents, strip leading street-type prefix."""
    norm = _normalize(s)
    return _STREET_PREFIX_RE.sub("", norm).strip()


def lookup_street(city_id: int, span_text: str) -> list[int]:
    """Return edge_ids for a street name within a city, or [] if not matched."""
    city_streets = _street_index.get(str(city_id), {})
    return city_streets.get(_normalize_street(span_text), [])


def lookup_street_all_cities(span_text: str) -> dict[int, list[int]]:
    """Try span against every city. Returns {city_id: [edge_ids]} for all matches."""
    norm = _normalize_street(span_text)
    results: dict[int, list[int]] = {}
    for city_id_str, streets in _street_index.items():
        if norm in streets:
            results[int(city_id_str)] = streets[norm]
    return results


def get_city_prior(source_name: str) -> int | None:
    """Return city_id prior for a known source, or None."""
    return _source_prior.get(source_name)
