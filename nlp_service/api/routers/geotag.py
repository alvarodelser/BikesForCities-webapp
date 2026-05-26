# nlp_service/api/routers/geotag.py
import logging

from fastapi import APIRouter, HTTPException

from api.models import (GeoCity, GeoPoint, GeoStreet, GeotagRequest,
                        GeotagResponse, PlaceMention)
from api.warmth import mark_warm
from nlp.geotagger import service as geotagger_service

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/geotag", response_model=GeotagResponse)
def geotag(req: GeotagRequest) -> GeotagResponse:
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="text must be non-empty")
    try:
        result = geotagger_service.run(
            req.text,
            headline=req.headline,
            source=req.source,
            scope_signal=req.scope_signal,
        )
    except FileNotFoundError as exc:
        log.error("geotagger data missing: %s", exc, extra={"article_id": req.article_id})
        raise HTTPException(status_code=503, detail="geotagger_data_missing")
    mark_warm("geotag")
    return GeotagResponse(
        article_id=req.article_id,
        geo_scope=result["geo_scope"],
        geo_region=result.get("geo_region"),
        geo_cities=[GeoCity(**c) for c in result["geo_cities"]],
        geo_streets=[GeoStreet(**s) for s in result["geo_streets"]],
        geo_points=[GeoPoint(**p) for p in result["geo_points"]],
        all_places=[PlaceMention(**p) for p in result["all_places"]],
        city=result.get("city"),
        city_confidence=result.get("city_confidence", 0.0),
    )
