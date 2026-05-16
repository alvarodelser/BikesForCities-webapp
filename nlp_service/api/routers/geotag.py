# nlp_service/api/routers/geotag.py
from fastapi import APIRouter, HTTPException

from api.models import GeotagRequest, GeotagResponse, PlaceMention
from api.warmth import mark_warm
from nlp.geotagger import service as geotagger_service

router = APIRouter()


@router.post("/geotag", response_model=GeotagResponse)
def geotag(req: GeotagRequest) -> GeotagResponse:
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="text must be non-empty")
    result = geotagger_service.run(req.text)
    mark_warm("geotag")
    return GeotagResponse(
        article_id=req.article_id,
        city=result["city"],
        city_confidence=result["city_confidence"],
        all_places=[PlaceMention(**p) for p in result["all_places"]],
    )
