from typing import List
from app.config import settings

def chunk_code(content: str, chunk_size: int = None) -> List[str]:
    if chunk_size is None:
        chunk_size = settings.CHUNK_SIZE

    chunks = []
    current = ""
    lines = content.splitlines()

    for line in lines:
        current += line + "\n"
        if len(current) > chunk_size:
            chunks.append(current)
            current = ""

    if current:
        chunks.append(current)

    return chunks
