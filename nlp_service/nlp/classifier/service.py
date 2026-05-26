# nlp_service/nlp/classifier/service.py
from __future__ import annotations

from . import model, taxonomy


def load() -> None:
    taxonomy.load()


def run(text: str) -> dict:
    tax = taxonomy.load()

    # Relevance gate: NLI hypothesis check
    if tax.relevance_hypothesis:
        rel = model.classify(text, labels=[tax.relevance_hypothesis], multi_label=True)
        rel_score = rel["scores"][0] if rel["scores"] else 0.0
        if rel_score < tax.relevance_threshold:
            return {"topics": [], "scores": {}, "out_of_scope": True}

    # Topic classification. Blacklist labels run in the same NLI call —
    # no extra inference cost. Any blacklist label above its threshold → OOS.
    all_labels = tax.labels + tax.blacklist_labels
    raw = model.classify(text, labels=all_labels, multi_label=True)
    scored = dict(zip(raw["labels"], raw["scores"]))

    if tax.blacklist_labels:
        top_blacklist_score = max(scored.get(lbl, 0.0) for lbl in tax.blacklist_labels)
        if top_blacklist_score >= tax.blacklist_threshold:
            return {"topics": [], "scores": scored, "out_of_scope": True}

    filtered = sorted(
        [(lbl, scored[lbl]) for lbl in tax.labels if scored.get(lbl, 0) >= tax.score_threshold],
        key=lambda x: x[1], reverse=True,
    )[:tax.top_k]

    return {
        "topics": [lbl for lbl, _ in filtered],
        "scores": {lbl: scored[lbl] for lbl in tax.labels},
        "out_of_scope": False,
    }

# NOTE: scope_signal (national/regional NLI classification) was removed from
# the pipeline. Future work: infer geo scope from a per-source prior in
# config/source_city_prior.json instead of a second NLI call per article.
