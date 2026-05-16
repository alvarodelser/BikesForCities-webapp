# nlp_service/nlp/classifier/service.py
from . import model, taxonomy


def load() -> None:
    taxonomy.load()
    # Model itself loads lazily on first call to keep cold-start cheap.


def run(text: str) -> dict:
    tax = taxonomy.load()

    # Relevance gate: reject articles outside urban alternative mobility scope
    if tax.relevance_hypothesis:
        rel = model.classify(text, labels=[tax.relevance_hypothesis], multi_label=True)
        rel_score = rel["scores"][0] if rel["scores"] else 0.0
        if rel_score < tax.relevance_threshold:
            return {"topics": [], "scores": {}, "out_of_scope": True}

    raw = model.classify(text, labels=tax.labels, multi_label=tax.multi_label)
    scored = list(zip(raw["labels"], raw["scores"]))
    filtered = [(label, score) for label, score in scored if score >= tax.score_threshold]
    filtered = filtered[: tax.top_k]
    return {
        "topics": [label for label, _ in filtered],
        "scores": {label: float(score) for label, score in scored},
        "out_of_scope": False,
    }
