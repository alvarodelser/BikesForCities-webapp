# nlp_service/nlp/summarizer/validator.py
import re

_SENTENCE_END = re.compile(r"[.!?]+")

HEADLINE_RANGE = (8, 15)
SUMMARY_RANGE = (2, 4)


def count_words(text: str) -> int:
    return len(text.split())


def count_sentences(text: str) -> int:
    parts = _SENTENCE_END.split(text)
    return sum(1 for p in parts if p.strip())


def validate(result: dict) -> tuple[bool, str | None]:
    """Returns (ok, reason). Reason is None when ok=True."""
    h_words = count_words(result["headline"])
    if h_words < HEADLINE_RANGE[0] or h_words > HEADLINE_RANGE[1]:
        return False, f"headline {h_words} words, want {HEADLINE_RANGE[0]}-{HEADLINE_RANGE[1]}"
    s_sentences = count_sentences(result["summary"])
    if s_sentences < SUMMARY_RANGE[0] or s_sentences > SUMMARY_RANGE[1]:
        return False, f"summary {s_sentences} sentences, want {SUMMARY_RANGE[0]}-{SUMMARY_RANGE[1]}"
    return True, None
