from typing import List
from app.embeddings.model import model

def generate_embedding(text: str) -> List[float]:
    embedding = model.encode(text)
    return embedding.tolist()

def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    embeddings = model.encode(texts, show_progress_bar=False)
    return [e.tolist() for e in embeddings]
