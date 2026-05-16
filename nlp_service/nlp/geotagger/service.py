# nlp_service/nlp/geotagger/service.py
from typing import Any

from . import disambiguator, gazetteer, ner


def load() -> None:
    """Eagerly load both gazetteer + cities (cheap; spaCy loads on first NER call)."""
    gazetteer.load()
    disambiguator.load()


def _place_payload(span_text: str, entries: list[gazetteer.GeoEntry]) -> dict[str, Any]:
    """First matching entry's coords if any; otherwise text-only."""
    if not entries:
        return {"text": span_text, "type": "other", "lat": None, "lon": None,
                "geonames_id": None, "city_id": None}
    e = entries[0]
    place_type = "city" if e.feature_class == "P" else ("region" if e.feature_class == "A" else "other")
    return {
        "text": span_text,
        "type": place_type,
        "lat": e.lat,
        "lon": e.lon,
        "geonames_id": e.geonames_id,
        "city_id": None,  # filled below if it matches a known city
    }


def run(text: str, headline: str = "") -> dict[str, Any]:
    load()
    spans = ner.extract_spans(text)
    spans_with_geo: list[tuple[str, list[gazetteer.GeoEntry]]] = []
    all_places: list[dict[str, Any]] = []

    for span in spans:
        entries = gazetteer.lookup(span.text)
        spans_with_geo.append((span.text, entries))
        all_places.append(_place_payload(span.text, entries))

    hit = disambiguator.score_candidates(spans_with_geo, full_text=text, headline=headline)

    if hit:
        for place in all_places:
            if place.get("geonames_id") == hit.geonames_id:
                place["city_id"] = hit.city_id
                place["type"] = "city"

    return {
        "city": hit.city_name if hit else None,
        "city_confidence": hit.score if hit else 0.0,
        "all_places": all_places,
    }
