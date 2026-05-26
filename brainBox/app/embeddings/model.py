from sentence_transformers import SentenceTransformer
from app.config import settings

model = SentenceTransformer(settings.EMBEDDING_MODEL)
