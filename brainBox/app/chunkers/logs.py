# from typing import List

# def chunk_logs(text: str, chunk_size: int = 50) -> List[str]:
#     lines = text.splitlines()
#     chunks = []
#     current = []

#     for line in lines:
#         current.append(line)
#         if len(current) >= chunk_size:
#             chunks.append("\n".join(current))
#             current = []

#     if current:
#         chunks.append("\n".join(current))

#     return chunks



from typing import List

def chunk_logs(text: str, chunk_size: int = 50, max_chunk_chars: int = 1200) -> List[str]:
    """
    Split log text into chunks.
    - chunk_size: max number of lines per chunk
    - max_chunk_chars: hard ceiling on characters per chunk (the critical fix)
    """
    lines = text.splitlines()
    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    for line in lines:
        line = line.rstrip()
        line_len = len(line) + 1  # +1 for the newline we'll join with

        # Safety: if a single line itself exceeds max_chunk_chars, hard-split it
        if line_len > max_chunk_chars:
            # Flush any pending lines first
            if current:
                chunks.append("\n".join(current))
                current = []
                current_len = 0

            # Hard-split the oversized line into fixed-size pieces
            for i in range(0, len(line), max_chunk_chars):
                chunks.append(line[i:i + max_chunk_chars])
            continue

        # If adding this line would exceed the char limit, flush current chunk
        if current and (current_len + line_len > max_chunk_chars):
            chunks.append("\n".join(current))
            current = [line]
            current_len = line_len
        else:
            current.append(line)
            current_len += line_len

        # If we've hit the line limit, flush the chunk
        if len(current) >= chunk_size:
            chunks.append("\n".join(current))
            current = []
            current_len = 0

    # Don't leave leftovers behind
    if current:
        chunks.append("\n".join(current))

    return chunks