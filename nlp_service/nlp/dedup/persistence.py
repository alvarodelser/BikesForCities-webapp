# nlp_service/nlp/dedup/persistence.py
import json
import logging
import os
import pickle
from pathlib import Path

from . import embedding_index, id_map, minhash_index

log = logging.getLogger(__name__)

DATA_DIR = Path(os.environ.get("DEDUP_DATA_DIR", "/data/dedup"))
SCHEMA_VERSION = 1


def save_all(mh_idx: minhash_index.MinHashIndex,
             emb_idx: embedding_index.EmbeddingIndex,
             ids: id_map.IdMap) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with (DATA_DIR / "minhash_lsh.pkl").open("wb") as f:
        pickle.dump({"lsh": mh_idx._lsh, "signatures": mh_idx._signatures,
                     "threshold": mh_idx.threshold}, f)
    (DATA_DIR / "faiss.index").write_bytes(emb_idx.serialize())
    (DATA_DIR / "id_map.json").write_text(json.dumps(ids.to_dict()), encoding="utf-8")
    (DATA_DIR / "state.json").write_text(json.dumps({
        "n_articles": len(ids),
        "schema_version": SCHEMA_VERSION,
    }), encoding="utf-8")
    log.info("dedup state flushed: %d articles", len(ids))


def load_all() -> tuple[minhash_index.MinHashIndex, embedding_index.EmbeddingIndex, id_map.IdMap]:
    state_path = DATA_DIR / "state.json"
    if not state_path.exists():
        log.info("no existing dedup state; starting empty")
        return (minhash_index.MinHashIndex(),
                embedding_index.EmbeddingIndex(),
                id_map.IdMap())

    state = json.loads(state_path.read_text(encoding="utf-8"))
    if state.get("schema_version") != SCHEMA_VERSION:
        log.warning("dedup schema_version mismatch (%s); starting empty",
                    state.get("schema_version"))
        return (minhash_index.MinHashIndex(),
                embedding_index.EmbeddingIndex(),
                id_map.IdMap())

    with (DATA_DIR / "minhash_lsh.pkl").open("rb") as f:
        mh_payload = pickle.load(f)
    mh = minhash_index.MinHashIndex(threshold=mh_payload["threshold"])
    mh._lsh = mh_payload["lsh"]
    mh._signatures = mh_payload["signatures"]

    emb = embedding_index.EmbeddingIndex()
    emb.deserialize((DATA_DIR / "faiss.index").read_bytes())

    ids = id_map.IdMap.from_dict(json.loads((DATA_DIR / "id_map.json").read_text(encoding="utf-8")))

    log.info("dedup state loaded: %d articles", len(ids))
    return mh, emb, ids
