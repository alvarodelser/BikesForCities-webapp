# nlp_service/api/routers/summarize.py
import logging

from fastapi import APIRouter, HTTPException
import httpx

from api.models import SummarizeRequest, SummarizeResponse
from api.warmth import mark_warm
from nlp.summarizer import service as summarizer_service

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest) -> SummarizeResponse:
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="text must be non-empty")
    try:
        result = summarizer_service.run(
            text=req.text,
            raw_headline=req.raw_headline,
            max_sentences=req.max_sentences,
        )
    except httpx.HTTPError as exc:
        log.error("ollama unavailable: %s", exc, extra={"article_id": req.article_id})
        raise HTTPException(status_code=503, detail="ollama_unavailable")
    except (KeyError, ValueError) as exc:
        log.error("ollama json format failed: %s", exc, extra={"article_id": req.article_id})
        raise HTTPException(status_code=503, detail="ollama_json_format_failed")

    mark_warm("summarize")
    return SummarizeResponse(
        article_id=req.article_id,
        headline=result["headline"],
        summary=result["summary"],
    )
