# nlp_service/nlp/summarizer/extractive.py
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words

_LANGUAGE = "spanish"
_summarizer = None


def _ensure_loaded() -> None:
    global _summarizer
    if _summarizer is None:
        _summarizer = TextRankSummarizer(Stemmer(_LANGUAGE))
        _summarizer.stop_words = get_stop_words(_LANGUAGE)


def extract_top_sentences(text: str, n: int) -> str:
    _ensure_loaded()
    tokenizer = Tokenizer(_LANGUAGE)  # per-call; Tokenizer holds mutable state
    parser = PlaintextParser.from_string(text, tokenizer)
    sentences = _summarizer(parser.document, n)
    return " ".join(str(s) for s in sentences)
