"""Document-aware text chunker for prose (PDF, DOCX, TXT, MD, XML, free text).

Packs paragraphs into ~``chunk_size`` character chunks. Paragraphs that are too
long are split on sentence boundaries, then on word boundaries; a word is only
hard-split when it alone exceeds the chunk size. Consecutive chunks share a
~``overlap`` character tail (starting on a word boundary) so context isn't lost
at the seams.
"""
import re
from typing import List

_SENTENCE_RE = re.compile(r"(?<=[.!?;:])\s+(?=\S)")
_MULTI_BLANK_RE = re.compile(r"\n\s*\n+")


def normalize_text(text: str) -> str:
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    lines = [re.sub(r"[ \t\f\v]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    return _MULTI_BLANK_RE.sub("\n\n", text).strip()


def _split_words(text: str, size: int) -> List[str]:
    pieces: List[str] = []
    current = ""
    for word in text.split(" "):
        if not word:
            continue
        while len(word) > size:  # pathological token (URL, base64...): hard split
            if current:
                pieces.append(current)
                current = ""
            pieces.append(word[:size])
            word = word[size:]
        candidate = f"{current} {word}" if current else word
        if len(candidate) > size and current:
            pieces.append(current)
            current = word
        else:
            current = candidate
    if current:
        pieces.append(current)
    return pieces


def _units(paragraph: str, size: int, split_size: int) -> List[str]:
    """Break a paragraph into units no longer than ``size`` (word-split pieces use ``split_size``
    so the overlap tail still fits in front of them)."""
    if len(paragraph) <= size:
        return [paragraph]
    units: List[str] = []
    for sentence in _SENTENCE_RE.split(paragraph):
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(sentence) <= size:
            units.append(sentence)
        else:
            units.extend(_split_words(sentence.replace("\n", " "), split_size))
    return units


def _overlap_tail(chunk: str, overlap: int) -> str:
    if overlap <= 0 or len(chunk) <= overlap:
        return ""
    tail = chunk[-overlap:]
    # start on a word boundary
    space = re.search(r"\s", tail)
    if space is None:
        return ""
    return tail[space.end():].strip()


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> List[str]:
    text = normalize_text(text)
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    overlap = max(0, min(overlap, chunk_size // 3))
    chunks: List[str] = []
    current = ""
    for paragraph in text.split("\n\n"):
        para_units = _units(paragraph, chunk_size, max(1, chunk_size - overlap - 1))
        for idx, unit in enumerate(para_units):
            sep = "\n\n" if idx == 0 else " "
            candidate = f"{current}{sep}{unit}" if current else unit
            if len(candidate) <= chunk_size or not current:
                current = candidate
                continue
            chunks.append(current)
            tail = _overlap_tail(current, overlap)
            current = f"{tail} {unit}" if tail and len(tail) + 1 + len(unit) <= chunk_size else unit
    if current:
        chunks.append(current)
    return chunks
