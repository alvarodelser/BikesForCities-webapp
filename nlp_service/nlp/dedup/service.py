# nlp_service/nlp/dedup/service.py
import logging
import os

from . import persistence

log = logging.getLogger(__name__)

_PERSIST_EVERY_N = int(os.environ.get("DEDUP_PERSIST_EVERY_N", "10"))

_mh = None
_emb = None
_ids = None
_indexings_since_flush = 0


def load() -> None:
    global _mh, _emb, _ids
    if _mh is None:
        _mh, _emb, _ids = persistence.load_all()


def flush() -> None:
    """Explicit flush — also called from the SIGTERM handler."""
    if _mh is not None and _emb is not None and _ids is not None:
        persistence.save_all(_mh, _emb, _ids)


def _maybe_flush() -> None:
    global _indexings_since_flush
    _indexings_since_flush += 1
    if _indexings_since_flush >= _PERSIST_EVERY_N:
        flush()
        _indexings_since_flush = 0


def check(article_id: str, text: str) -> dict:
    """Returns the DedupResponse payload as a plain dict."""
    load()
    assert _mh is not None and _emb is not None and _ids is not None

    # Already seen — treat as duplicate of itself (don't re-add).
    if _ids.has(article_id):
        return {"duplicate_of": article_id, "stage": "minhash", "score": 1.0,
                "indexed": False}

    # Stage 1: MinHash LSH
    best_aid, best_jaccard = _mh.query(text)
    if best_aid is not None and best_jaccard >= _mh.threshold:
        return {"duplicate_of": best_aid, "stage": "minhash",
                "score": float(best_jaccard), "indexed": False}

    # Stage 2: Embedding
    best_row, best_cosine = _emb.query(text)
    if best_row is not None and best_cosine >= _emb.threshold:
        dup_aid = _ids.article_id_for(best_row)
        return {"duplicate_of": dup_aid, "stage": "embedding",
                "score": float(best_cosine), "indexed": False}

    # Not a duplicate — index it.
    _mh.add(article_id, text)
    _emb_row = _emb.add(text)
    mapped_row = _ids.add(article_id)
    assert _emb_row == mapped_row, "IdMap and FAISS row counters drifted apart"
    _maybe_flush()
    return {"duplicate_of": None, "stage": None, "score": None, "indexed": True}


def bootstrap(articles: list[dict]) -> dict:
    """Rebuild indexes from a list of {article_id, text}."""
    global _mh, _emb, _ids, _indexings_since_flush
    from . import minhash_index, embedding_index, id_map
    _mh = minhash_index.MinHashIndex()
    _emb = embedding_index.EmbeddingIndex()
    _ids = id_map.IdMap()
    duplicates_found = 0
    indexed = 0
    for art in articles:
        result = check(art["article_id"], art["text"])
        if result["duplicate_of"] is not None:
            duplicates_found += 1
        if result["indexed"]:
            indexed += 1
    flush()
    _indexings_since_flush = 0
    return {"processed": len(articles), "duplicates_found": duplicates_found, "indexed": indexed}
