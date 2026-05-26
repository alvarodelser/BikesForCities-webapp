# nlp_service/nlp/classifier/service.py
from __future__ import annotations

from . import model, taxonomy

_SCOPE_HYPOTHESES = {
    "national": (
        "Este artículo trata sobre una política o iniciativa de movilidad "
        "a nivel nacional en España, sin estar limitado a una ciudad o región específica."
    ),
    "regional": (
        "Este artículo trata sobre movilidad en una comunidad autónoma, "
        "provincia o región específica de España."
    ),
}
_SCOPE_THRESHOLD = 0.45   # tunable; separate from relevance_threshold


def load() -> None:
    taxonomy.load()


def _classify_scope(text: str) -> str | None:
    labels = list(_SCOPE_HYPOTHESES.values())
    raw = model.classify(text, labels=labels, multi_label=False)
    top_score = raw["scores"][0]
    if top_score < _SCOPE_THRESHOLD:
        return None
    top_label = raw["labels"][0]
    for name, hyp in _SCOPE_HYPOTHESES.items():
        if top_label == hyp:
            return name
    return None


def run(text: str) -> dict:
    tax = taxonomy.load()

    # Relevance gate: reject articles outside urban alternative mobility scope
    if tax.relevance_hypothesis:
        rel = model.classify(text, labels=[tax.relevance_hypothesis], multi_label=True)
        rel_score = rel["scores"][0] if rel["scores"] else 0.0
        if rel_score < tax.relevance_threshold:
            return {"topics": [], "scores": {}, "out_of_scope": True, "scope_signal": None}

    raw = model.classify(text, labels=tax.labels, multi_label=tax.multi_label)
    scored = list(zip(raw["labels"], raw["scores"]))
    filtered = [(label, score) for label, score in scored if score >= tax.score_threshold]
    filtered = filtered[:tax.top_k]

    scope_signal = _classify_scope(text)

    return {
        "topics": [label for label, _ in filtered],
        "scores": {label: float(score) for label, score in scored},
        "out_of_scope": False,
        "scope_signal": scope_signal,
    }
