# nlp_service/nlp/geotagger/ner.py
from dataclasses import dataclass

import spacy

_nlp = None
_KEEP_LABELS = {"LOC", "GPE", "FAC"}


def _ensure_loaded() -> None:
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("es_core_news_lg", disable=["parser", "tagger", "attribute_ruler"])


@dataclass
class Span:
    text: str
    label: str
    start_char: int
    end_char: int


def extract_spans(text: str) -> list[Span]:
    _ensure_loaded()
    assert _nlp is not None
    doc = _nlp(text)
    return [
        Span(text=ent.text, label=ent.label_, start_char=ent.start_char, end_char=ent.end_char)
        for ent in doc.ents
        if ent.label_ in _KEEP_LABELS
    ]
