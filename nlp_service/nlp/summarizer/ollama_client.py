# nlp_service/nlp/summarizer/ollama_client.py
import os
import json
import time
import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma4:e2b")

_JSON_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "summary": {"type": "string"},
    },
    "required": ["headline", "summary"],
}


def _call_once(prompt: str, timeout: float) -> dict[str, Any]:
    response = httpx.post(
        f"{OLLAMA_HOST}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": _JSON_SCHEMA,
        },
        timeout=timeout,
    )
    response.raise_for_status()
    body = response.json()
    return json.loads(body["response"])


def generate(prompt: str, max_retries: int = 3, timeout: float = 30.0) -> dict[str, Any]:
    """Forced-JSON Ollama call. Returns dict with `headline` and `summary` keys.

    Raises the last httpx error if all retries fail.
    Raises ValueError if Ollama returns malformed JSON after all retries.
    """
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            return _call_once(prompt, timeout)
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            last_error = exc
            log.warning("ollama call failed (attempt %d/%d): %s", attempt + 1, max_retries, exc)
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
    assert last_error is not None
    raise last_error
