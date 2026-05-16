# nlp_service/api/main.py
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response

logging.basicConfig(
    level=os.environ.get("NLP_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("nlp_service")

# Tracks which capabilities have been hit at least once (for /readyz).
_warm_capabilities: set[str] = set()


def mark_warm(capability: str) -> None:
    _warm_capabilities.add(capability)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("nlp-service starting up")
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
    missing = expected - _warm_capabilities
    if missing:
        response.status_code = 503
        return {"status": "warming", "missing": sorted(missing)}
    return {"status": "ready"}


from api.routers import summarize as summarize_router  # noqa: E402

app.include_router(summarize_router.router)
