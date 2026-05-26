# nlp_service/nlp/classifier/taxonomy.py
import os
from dataclasses import dataclass
from pathlib import Path

import yaml

_CONFIG_PATH = Path(os.environ.get("TOPICS_YAML_PATH", "/app/config/topics.yaml"))
_taxonomy: "Taxonomy | None" = None


@dataclass
class Taxonomy:
    labels: list[str]
    multi_label: bool
    score_threshold: float
    top_k: int
    relevance_hypothesis: str
    relevance_threshold: float
    blacklist_labels: list[str]
    blacklist_threshold: float


def load() -> Taxonomy:
    global _taxonomy
    if _taxonomy is None:
        data = yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8"))
        _taxonomy = Taxonomy(
            labels=data["labels"],
            multi_label=bool(data.get("multi_label", True)),
            score_threshold=float(data.get("score_threshold", 0.5)),
            top_k=int(data.get("top_k", 3)),
            relevance_hypothesis=str(data.get("relevance_hypothesis", "")),
            relevance_threshold=float(data.get("relevance_threshold", 0.4)),
            blacklist_labels=list(data.get("blacklist_labels", [])),
            blacklist_threshold=float(data.get("blacklist_threshold", 0.7)),
        )
    return _taxonomy
