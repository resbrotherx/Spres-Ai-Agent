from typing import List
import csv
from io import StringIO

def chunk_csv(content: str, rows_per_chunk: int = 100) -> List[str]:
    try:
        reader = csv.reader(StringIO(content))
        rows = list(reader)
        chunks = []

        for i in range(0, len(rows), rows_per_chunk):
            chunk_rows = rows[i:i + rows_per_chunk]
            chunk_content = "\n".join([",".join(row) for row in chunk_rows])
            chunks.append(chunk_content)

        return chunks if chunks else [content]
    except Exception:
        return [content]
