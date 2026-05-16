# eval/_scorecard.py
# Shared helpers for all eval notebooks.
import json
from pathlib import Path
from typing import Any


FIXTURES_DIR = Path(__file__).parent / "fixtures"
NLP_BASE_URL = "http://localhost:8001"


def load_fixture(name: str) -> list[dict]:
    return json.loads((FIXTURES_DIR / name).read_text())


def print_scorecard(title: str, metrics: dict[str, Any]) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k:<35} {v:.3f}")
        else:
            print(f"  {k:<35} {v}")
    print(f"{'='*60}\n")


def rouge1_f(reference: str, hypothesis: str) -> float:
    """Unigram overlap F1 (token-level, lowercased, punctuation stripped)."""
    import re
    def tokenize(s: str) -> list[str]:
        return re.findall(r"\w+", s.lower())

    ref_tokens = tokenize(reference)
    hyp_tokens = tokenize(hypothesis)
    if not ref_tokens or not hyp_tokens:
        return 0.0
    ref_set = set(ref_tokens)
    hyp_set = set(hyp_tokens)
    overlap = len(ref_set & hyp_set)
    precision = overlap / len(hyp_set)
    recall = overlap / len(ref_set)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def keyword_hit_rate(text: str, keywords: list[str]) -> float:
    text_lower = text.lower()
    if not keywords:
        return 1.0
    hits = sum(1 for kw in keywords if kw.lower() in text_lower)
    return hits / len(keywords)
