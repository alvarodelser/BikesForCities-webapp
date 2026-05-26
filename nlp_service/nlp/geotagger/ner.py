# nlp_service/nlp/geotagger/ner.py
import re
from dataclasses import dataclass, field

from transformers import pipeline as hf_pipeline

_MODEL = "PlanTL-GOB-ES/roberta-base-bne-ner-capiter"
_ner_pipeline = None
_KEEP_LABELS = {"LOC"}

_STREET_RE = re.compile(
    r'(?:^|(?<=\s))'
    r'(?:Calle|Avda?\.?|Avenida|Plaza|Pza\.?|Paseo|Ps\.?|'
    r'Glorieta|Ronda|C/|Camino|Carretera|Ctra\.?)\s+'
    r'([A-ZÁÉÍÓÚÜÑ][^\n,;.]{2,50})',
    re.IGNORECASE,
)


@dataclass
class Span:
    text: str
    label: str
    start_char: int
    end_char: int
    hint: str = ""   # "street" when matched by prefix regex


def _ensure_loaded() -> None:
    global _ner_pipeline
    if _ner_pipeline is None:
        _ner_pipeline = hf_pipeline(
            "token-classification",
            model=_MODEL,
            aggregation_strategy="simple",
            device=-1,   # CPU; set to 0 for GPU
        )


def extract_spans(text: str) -> list[Span]:
    _ensure_loaded()
    assert _ner_pipeline is not None

    # Stage A1: transformer NER
    raw = _ner_pipeline(text)
    ner_spans: list[Span] = [
        Span(
            text=e["word"],
            label=e["entity_group"],
            start_char=e["start"],
            end_char=e["end"],
        )
        for e in raw
        if e["entity_group"] in _KEEP_LABELS
    ]

    # Track covered char ranges to avoid double-counting
    covered: set[tuple[int, int]] = {(s.start_char, s.end_char) for s in ner_spans}

    # Stage A2: street-prefix regex (post-NER layer)
    street_spans: list[Span] = []
    for m in _STREET_RE.finditer(text):
        start, end = m.start(), m.end()
        # skip if already covered by NER
        if any(s <= start < e or s < end <= e for s, e in covered):
            continue
        full_match = m.group(0).strip()
        street_spans.append(Span(
            text=full_match,
            label="LOC",
            start_char=start,
            end_char=end,
            hint="street",
        ))
        covered.add((start, end))

    return ner_spans + street_spans
