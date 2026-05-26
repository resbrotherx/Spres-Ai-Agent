from typing import List
import json

def chunk_json(content: str, chunk_size: int = 2000) -> List[str]:
    try:
        data = json.loads(content)
        json_str = json.dumps(data, indent=2)
        lines = json_str.splitlines()
        chunks = []
        current = ""

        for line in lines:
            current += line + "\n"
            if len(current) > chunk_size:
                chunks.append(current)
                current = ""

        if current:
            chunks.append(current)

        return chunks
    except json.JSONDecodeError:
        return [content]
