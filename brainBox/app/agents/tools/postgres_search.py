from typing import List, Tuple
from sqlalchemy import text
from app.db.session import SessionLocal
from app.utils.logging import logger

def postgres_search(query: str, tenant_id: str, limit: int = 5) -> List[Tuple]:
    try:
        db = SessionLocal()

        sql = text("""
        SELECT
            id,
            content,
            source_type,
            file_path
        FROM documents
        WHERE tenant_id = :tenant_id
            AND (content ILIKE :query OR file_path ILIKE :query)
        LIMIT :limit
        """)

        results = db.execute(
            sql,
            {
                "tenant_id": tenant_id,
                "query": f"%{query}%",
                "limit": limit
            }
        )

        return results.fetchall()
    except Exception as e:
        logger.error(f"Error in postgres_search: {str(e)}")
        return []
    finally:
        db.close()

def full_text_search(query: str, tenant_id: str, limit: int = 5) -> List[Tuple]:
    try:
        db = SessionLocal()

        sql = text("""
        SELECT
            id,
            content,
            source_type,
            file_path
        FROM documents
        WHERE tenant_id = :tenant_id
            AND to_tsvector('english', content) @@ plainto_tsquery('english', :query)
        LIMIT :limit
        """)

        results = db.execute(
            sql,
            {
                "tenant_id": tenant_id,
                "query": query,
                "limit": limit
            }
        )

        return results.fetchall()
    except Exception as e:
        logger.error(f"Error in full_text_search: {str(e)}")
        return []
    finally:
        db.close()
