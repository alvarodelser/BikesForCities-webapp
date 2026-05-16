# nlp_service/api/models.py
from pydantic import BaseModel, Field
from typing import Literal

# --- Summarize ---

class SummarizeRequest(BaseModel):
    article_id: str
    text: str
    raw_headline: str
    max_sentences: int = 3


class SummarizeResponse(BaseModel):
    article_id: str
    headline: str
    summary: str


# --- Geotag ---

class GeotagRequest(BaseModel):
    article_id: str
    text: str


class PlaceMention(BaseModel):
    text: str
    type: Literal["city", "street", "region", "other"]
    lat: float | None = None
    lon: float | None = None
    geonames_id: int | None = None
    city_id: int | None = None


class GeotagResponse(BaseModel):
    article_id: str
    city: str | None
    city_confidence: float
    all_places: list[PlaceMention]


# --- Classify ---

class ClassifyRequest(BaseModel):
    article_id: str
    text: str


class ClassifyResponse(BaseModel):
    article_id: str
    topics: list[str]
    scores: dict[str, float]


# --- Dedup ---

class DedupRequest(BaseModel):
    article_id: str
    text: str


class DedupResponse(BaseModel):
    article_id: str
    duplicate_of: str | None
    stage: Literal["minhash", "embedding"] | None = None
    score: float | None = None
    indexed: bool


class BootstrapRequest(BaseModel):
    articles: list[dict] = Field(
        ...,
        description="Each item: {article_id: str, text: str}"
    )


class BootstrapResponse(BaseModel):
    processed: int
    duplicates_found: int
    indexed: int
