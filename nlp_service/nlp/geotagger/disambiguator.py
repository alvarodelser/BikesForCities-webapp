# nlp_service/nlp/geotagger/disambiguator.py
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from . import gazetteer

_CITIES_PATH = Path(__file__).parent / "data" / "cities_snapshot.json"
_cities: list[dict] = []
_by_wikidata: dict[str, dict] = {}
_by_name: dict[str, dict] = {}
_max_population = 1


@dataclass
class CityHit:
    city_name: str
    city_id: int
    lat: float
    lon: float
    geonames_id: int | None
    score: float


def load() -> None:
    global _cities, _by_wikidata, _by_name, _max_population
    if _cities:
        return
    _cities = json.loads(_CITIES_PATH.read_text(encoding="utf-8"))
    for c in _cities:
        if c.get("wikidata_id"):
            _by_wikidata[c["wikidata_id"]] = c
        _by_name[gazetteer._normalize(c["name"])] = c
        if c.get("alt_name"):
            _by_name[gazetteer._normalize(c["alt_name"])] = c
    if _cities:
        _max_population = max(c.get("population") or 1 for c in _cities)


def _match_city(geo_entry: gazetteer.GeoEntry) -> dict | None:
    # GeoNames doesn't carry wikidata_id directly in the basic dump, so
    # match by name. Future: use the alternate-names dump for tighter linkage.
    return _by_name.get(gazetteer._normalize(geo_entry.name))


def score_candidates(
    spans_with_geo: list[tuple[str, list[gazetteer.GeoEntry]]],
    full_text: str,
    headline: str,
    source_prior_city_id: int | None = None,
) -> CityHit | None:
    """Score each candidate city. Returns highest-scoring CityHit, or None."""
    load()
    if not _cities:
        return None

    city_scores: dict[int, float] = {}
    city_geo: dict[int, gazetteer.GeoEntry] = {}
    text_lower = full_text.lower()
    headline_lower = headline.lower()

    for span_text, candidates in spans_with_geo:
        for entry in candidates:
            if entry.feature_class != "P":
                continue
            city = _match_city(entry)
            if not city:
                continue
            cid = city["id"]
            freq = text_lower.count(entry.name.lower())
            pop_norm = (entry.population or 0) / max(_max_population, 1)
            in_title = 1.0 if entry.name.lower() in headline_lower else 0.0
            score = 0.5 * min(freq, 5) / 5 + 0.3 * pop_norm + 0.2 * in_title
            # Source prior: small additive boost when a known source maps to this city
            if source_prior_city_id is not None and cid == source_prior_city_id:
                score = min(score + 0.1, 1.0)
            if score > city_scores.get(cid, 0):
                city_scores[cid] = score
                city_geo[cid] = entry

    if not city_scores:
        return None

    best_cid = max(city_scores, key=lambda k: city_scores[k])
    city = next(c for c in _cities if c["id"] == best_cid)
    entry = city_geo[best_cid]
    return CityHit(
        city_name=city["name"],
        city_id=best_cid,
        lat=entry.lat,
        lon=entry.lon,
        geonames_id=entry.geonames_id,
        score=city_scores[best_cid],
    )
