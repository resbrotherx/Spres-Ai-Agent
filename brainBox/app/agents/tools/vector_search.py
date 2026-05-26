from typing import List, Tuple
from sqlalchemy import text
from app.embeddings.generator import generate_embedding
from app.db.session import SessionLocal
from app.utils.logging import logger

def semantic_search(query: str, tenant_id: str, limit: int = 5) -> List[Tuple]:
    try:
        db = SessionLocal()
        embedding = generate_embedding(query)

        sql = text("""
        SELECT
            id,
            content,
            source_type,
            file_path,
            (embedding <=> :embedding) AS distance
        FROM documents
        WHERE tenant_id = :tenant_id
        ORDER BY embedding <=> :embedding
        LIMIT :limit
        """)

        results = db.execute(
            sql,
            {
                "embedding": embedding,
                "tenant_id": tenant_id,
                "limit": limit
            }
        )

        return results.fetchall()
    except Exception as e:
        logger.error(f"Error in semantic_search: {str(e)}")
        return []
    finally:
        db.close()

def hybrid_search(query: str, tenant_id: str, limit: int = 5) -> List[Tuple]:
    try:
        db = SessionLocal()
        embedding = generate_embedding(query)

        sql = text("""
        SELECT
            id,
            content,
            source_type,
            file_path,
            (embedding <=> :embedding) AS distance
        FROM documents
        WHERE tenant_id = :tenant_id
            AND (content ILIKE :query OR file_path ILIKE :query)
        ORDER BY embedding <=> :embedding
        LIMIT :limit
        """)

        results = db.execute(
            sql,
            {
                "embedding": embedding,
                "tenant_id": tenant_id,
                "query": f"%{query}%",
                "limit": limit
            }
        )

        return results.fetchall()
    except Exception as e:
        logger.error(f"Error in hybrid_search: {str(e)}")
        return []
    finally:
        db.close()
