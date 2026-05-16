# nlp_service/nlp/summarizer/service.py
import logging
from pathlib import Path

from . import extractive, ollama_client, validator

log = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent / "prompts" / "rewrite.es.txt"
_PROMPT_TEMPLATE: str | None = None
_EXTRACTIVE_TOKEN_THRESHOLD = 500
_RETRY_SUFFIX = "\nRECUERDA: titular 8-15 palabras, resumen 2-4 frases."


def load() -> None:
    """Lazy-load the prompt template."""
    global _PROMPT_TEMPLATE
    if _PROMPT_TEMPLATE is None:
        _PROMPT_TEMPLATE = _PROMPT_PATH.read_text(encoding="utf-8")


def _count_tokens(text: str) -> int:
    # Whitespace-split is a reasonable token proxy for Spanish.
    return len(text.split())


def run(text: str, raw_headline: str, max_sentences: int = 3) -> dict:
    """Returns {'headline': str, 'summary': str}."""
    load()
    assert _PROMPT_TEMPLATE is not None

    if _count_tokens(text) >= _EXTRACTIVE_TOKEN_THRESHOLD:
        extract = extractive.extract_top_sentences(text, max_sentences)
    else:
        extract = text

    prompt = _PROMPT_TEMPLATE.format(raw_headline=raw_headline, extract=extract)
    result = ollama_client.generate(prompt)

    ok, reason = validator.validate(result)
    if not ok:
        log.info("validator rejected (%s), retrying once with tightened prompt", reason)
        result = ollama_client.generate(prompt + _RETRY_SUFFIX)
        # No further retry; accept whatever comes back.

    return {"headline": result["headline"], "summary": result["summary"]}
