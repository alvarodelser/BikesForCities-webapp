# nlp_service/nlp/geotagger/service.py
from __future__ import annotations

from typing import Any

from . import disambiguator, gazetteer, ner


def load() -> None:
    gazetteer.load()
    gazetteer.load_streets()
    gazetteer.load_source_prior()
    disambiguator.load()


def _resolve_scope(
    scope_signal: str | None,
    geo_cities: list[dict],
    geo_region: str | None,
) -> str:
    if scope_signal in ("national", "regional"):
        return scope_signal
    if geo_cities:
        return "city"
    if geo_region:
        return "regional"
    return "national"


def run(
    text: str,
    headline: str = "",
    source: str = "",
    scope_signal: str | None = None,
) -> dict[str, Any]:
    load()

    full_input = f"{headline}. {text}" if headline else text

    # ── Stage A: Toponym identification ───────────────────────────────────────
    spans = ner.extract_spans(full_input)

    street_spans = [s for s in spans if s.hint == "street"]
    loc_spans    = [s for s in spans if s.hint != "street"]

    # ── Stage B1: City resolution ─────────────────────────────────────────────
    source_prior_city_id = gazetteer.get_city_prior(source) if source else None

    spans_with_geo = [
        (s.text, gazetteer.lookup(s.text)) for s in loc_spans
    ]
    city_hit = disambiguator.score_candidates(
        spans_with_geo,
        full_text=text,
        headline=headline,
        source_prior_city_id=source_prior_city_id,
    )

    geo_cities: list[dict] = []
    if city_hit:
        geo_cities = [{
            "city_id": city_hit.city_id,
            "city_name": city_hit.city_name,
            "confidence": city_hit.score,
        }]
    winning_city_id = city_hit.city_id if city_hit else None

    # ── Stage B2: Street resolution (city-scoped) ─────────────────────────────
    geo_streets: list[dict] = []
    for s in street_spans:
        if winning_city_id:
            edge_ids = gazetteer.lookup_street(winning_city_id, s.text)
            if edge_ids:
                geo_streets.append({"span": s.text, "edge_ids": edge_ids, "city_id": winning_city_id})
                continue
        # No known city — try all cities
        matches = gazetteer.lookup_street_all_cities(s.text)
        if len(matches) == 1:
            cid, edge_ids = next(iter(matches.items()))
            geo_streets.append({"span": s.text, "edge_ids": edge_ids, "city_id": cid})
        elif len(matches) > 1 and source_prior_city_id and source_prior_city_id in matches:
            geo_streets.append({
                "span": s.text,
                "edge_ids": matches[source_prior_city_id],
                "city_id": source_prior_city_id,
            })
        else:
            geo_streets.append({"span": s.text, "edge_ids": [], "city_id": None})

    # ── Stage B3: Regional + raw points ──────────────────────────────────────
    geo_points: list[dict] = []
    geo_region: str | None = None

    for span_text, entries in spans_with_geo:
        for entry in entries:
            if entry.feature_class == "A" and not geo_region:
                geo_region = entry.name
            elif entry.feature_class == "P" and not city_hit:
                best = max(entries, key=lambda x: x.population)
                geo_points.append({
                    "span": span_text,
                    "lat": best.lat,
                    "lon": best.lon,
                    "geonames_id": best.geonames_id,
                })

    # ── Scope imputation ──────────────────────────────────────────────────────
    geo_scope = _resolve_scope(scope_signal, geo_cities, geo_region)

    # ── Backward-compat all_places ────────────────────────────────────────────
    all_places: list[dict] = []
    for span_text, entries in spans_with_geo:
        if not entries:
            all_places.append({"text": span_text, "type": "other",
                                "lat": None, "lon": None,
                                "geonames_id": None, "city_id": None})
            continue
        best = max(entries, key=lambda x: x.population)
        ptype = "city" if best.feature_class == "P" else ("region" if best.feature_class == "A" else "other")
        cid = city_hit.city_id if (city_hit and best.geonames_id == city_hit.geonames_id) else None
        all_places.append({
            "text": span_text, "type": ptype,
            "lat": best.lat, "lon": best.lon,
            "geonames_id": best.geonames_id, "city_id": cid,
        })
    for s in street_spans:
        all_places.append({"text": s.text, "type": "street",
                            "lat": None, "lon": None,
                            "geonames_id": None, "city_id": winning_city_id})

    return {
        "geo_scope": geo_scope,
        "geo_region": geo_region,
        "geo_cities": geo_cities,
        "geo_streets": geo_streets,
        "geo_points": geo_points,
        "all_places": all_places,
        # legacy fields kept for the existing eval notebook
        "city": city_hit.city_name if city_hit else None,
        "city_confidence": city_hit.score if city_hit else 0.0,
    }
