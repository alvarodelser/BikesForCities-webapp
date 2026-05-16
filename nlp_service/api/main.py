# nlp_service/api/main.py
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response

from api.warmth import get_missing

logging.basicConfig(
    level=os.environ.get("NLP_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("nlp_service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("nlp-service starting up")
    # Eagerly load spaCy + geotagger data so the first request doesn't race
    # on _nlp initialisation under concurrent threads.
    from nlp.geotagger import ner as _ner
    from nlp.geotagger import service as _geo_svc
    _ner._ensure_loaded()
    _geo_svc.load()
    yield
    log.info("nlp-service shutting down")
    # Capability shutdown hooks (e.g. dedup flush) are registered as
    # FastAPI shutdown handlers in their respective routers — they run before
    # this lifespan exit block.


app = FastAPI(title="NLP Service", lifespan=lifespan)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.get("/readyz")
def readyz(response: Response) -> dict:
    expected = {"summarize", "geotag", "classify", "dedup"}
    missing = get_missing(expected)
    if missing:
        response.status_code = 503
        return {"status": "warming", "missing": missing}
    return {"status": "ready"}


def _register_routers() -> None:
    from api.routers import summarize as summarize_router
    from api.routers import geotag as geotag_router
    app.include_router(summarize_router.router)
    app.include_router(geotag_router.router)


_register_routers()
