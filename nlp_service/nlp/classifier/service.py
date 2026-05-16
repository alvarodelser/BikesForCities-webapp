# nlp_service/nlp/classifier/service.py
from . import model, taxonomy


def load() -> None:
    taxonomy.load()
    # Model itself loads lazily on first call to keep cold-start cheap.


def run(text: str) -> dict:
    tax = taxonomy.load()
    raw = model.classify(text, labels=tax.labels, multi_label=tax.multi_label)
    scored = list(zip(raw["labels"], raw["scores"]))
    # Filter + top-k
    filtered = [(label, score) for label, score in scored if score >= tax.score_threshold]
    filtered = filtered[: tax.top_k]
    return {
        "topics": [label for label, _ in filtered],
        "scores": {label: float(score) for label, score in scored},
    }
