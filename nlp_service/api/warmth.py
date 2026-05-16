# nlp_service/api/warmth.py
_warm_capabilities: set[str] = set()


def mark_warm(capability: str) -> None:
    _warm_capabilities.add(capability)


def get_missing(expected: set[str]) -> list[str]:
    return sorted(expected - _warm_capabilities)
