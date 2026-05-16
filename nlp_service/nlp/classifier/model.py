# nlp_service/nlp/classifier/model.py
from transformers import pipeline

_MODEL_NAME = "Recognai/bert-base-spanish-wwm-cased-xnli"
_pipeline = None


def _ensure_loaded() -> None:
    global _pipeline
    if _pipeline is None:
        _pipeline = pipeline("zero-shot-classification", model=_MODEL_NAME)


def classify(text: str, labels: list[str], multi_label: bool) -> dict:
    """Returns the raw transformers pipeline output dict.
    Keys: 'sequence', 'labels' (sorted by score desc), 'scores'.
    """
    _ensure_loaded()
    assert _pipeline is not None
    return _pipeline(text, candidate_labels=labels, multi_label=multi_label)
