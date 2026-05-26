from typing import List

def chunk_logs(text: str, chunk_size: int = 50) -> List[str]:
    lines = text.splitlines()
    chunks = []
    current = []

    for line in lines:
        current.append(line)
        if len(current) >= chunk_size:
            chunks.append("\n".join(current))
            current = []

    if current:
        chunks.append("\n".join(current))

    return chunks
