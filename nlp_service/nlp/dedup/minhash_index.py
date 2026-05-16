# nlp_service/nlp/dedup/minhash_index.py
import os
import unicodedata

from datasketch import MinHash, MinHashLSH

_NUM_PERM = 128
_SHINGLE_SIZE = 3


def _normalize(text: str) -> str:
    text = text.lower()
    text = "".join(c for c in unicodedata.normalize("NFD", text)
                   if unicodedata.category(c) != "Mn")
    return text


def _shingles(text: str) -> list[str]:
    words = _normalize(text).split()
    if len(words) < _SHINGLE_SIZE:
        return [" ".join(words)] if words else []
    return [" ".join(words[i:i + _SHINGLE_SIZE]) for i in range(len(words) - _SHINGLE_SIZE + 1)]


def compute(text: str) -> MinHash:
    mh = MinHash(num_perm=_NUM_PERM)
    for s in _shingles(text):
        mh.update(s.encode("utf-8"))
    return mh


class MinHashIndex:
    def __init__(self, threshold: float | None = None) -> None:
        self.threshold = threshold if threshold is not None else float(
            os.environ.get("DEDUP_LSH_THRESHOLD", "0.9")
        )
        self._lsh = MinHashLSH(threshold=self.threshold, num_perm=_NUM_PERM)
        self._signatures: dict[str, MinHash] = {}

    def query(self, text: str) -> tuple[str | None, float]:
        """Returns (best_article_id, jaccard_score) or (None, 0.0)."""
        mh = compute(text)
        keys = self._lsh.query(mh)
        if not keys:
            return None, 0.0
        best_key, best_score = None, 0.0
        for k in keys:
            score = mh.jaccard(self._signatures[k])
            if score > best_score:
                best_key, best_score = k, score
        return best_key, best_score

    def add(self, article_id: str, text: str) -> None:
        mh = compute(text)
        self._lsh.insert(article_id, mh)
        self._signatures[article_id] = mh

    def __contains__(self, article_id: str) -> bool:
        return article_id in self._signatures

    def __len__(self) -> int:
        return len(self._signatures)
