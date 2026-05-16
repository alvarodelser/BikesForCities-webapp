# nlp_service/api/routers/dedup.py
import logging

from fastapi import APIRouter, HTTPException

from api.models import (
    DedupRequest, DedupResponse, BootstrapRequest, BootstrapResponse,
)
from api.warmth import mark_warm
from nlp.dedup import service as dedup_service

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/dedup-check", response_model=DedupResponse)
def dedup_check(req: DedupRequest) -> DedupResponse:
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="text must be non-empty")
    result = dedup_service.check(req.article_id, req.text)
    mark_warm("dedup")
    return DedupResponse(
        article_id=req.article_id,
        duplicate_of=result["duplicate_of"],
        stage=result["stage"],
        score=result["score"],
        indexed=result["indexed"],
    )


@router.post("/dedup/bootstrap", response_model=BootstrapResponse)
def dedup_bootstrap(req: BootstrapRequest) -> BootstrapResponse:
    articles = [{"article_id": a.article_id, "text": a.text} for a in req.articles]
    counts = dedup_service.bootstrap(articles)
    mark_warm("dedup")
    return BootstrapResponse(
        processed=counts["processed"],
        duplicates_found=counts["duplicates_found"],
        indexed=counts["indexed"],
    )
