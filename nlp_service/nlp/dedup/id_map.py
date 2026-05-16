# nlp_service/nlp/dedup/id_map.py
class IdMap:
    """Bidirectional article_id <-> faiss_row_index mapping."""

    def __init__(self) -> None:
        self._aid_to_row: dict[str, int] = {}
        self._row_to_aid: dict[int, str] = {}
        self._next_row = 0

    def add(self, article_id: str) -> int:
        if article_id in self._aid_to_row:
            return self._aid_to_row[article_id]
        row = self._next_row
        self._next_row += 1
        self._aid_to_row[article_id] = row
        self._row_to_aid[row] = article_id
        return row

    def article_id_for(self, row: int) -> str | None:
        return self._row_to_aid.get(row)

    def has(self, article_id: str) -> bool:
        return article_id in self._aid_to_row

    def to_dict(self) -> dict:
        return {
            "aid_to_row": self._aid_to_row,
            "next_row": self._next_row,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "IdMap":
        m = cls()
        m._aid_to_row = {k: int(v) for k, v in data["aid_to_row"].items()}
        m._row_to_aid = {v: k for k, v in m._aid_to_row.items()}
        m._next_row = int(data["next_row"])
        return m

    def __len__(self) -> int:
        return len(self._aid_to_row)
