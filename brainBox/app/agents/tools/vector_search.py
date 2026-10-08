from typing import Any, Dict, List, Optional, Sequence, Tuple
from sqlalchemy import bindparam, text
from app.embeddings.generator import generate_embedding
from app.db.session import SessionLocal
from app.utils.logging import logger
from app.permissions import legacy_doc_audience


def audience_filter(audiences: Optional[Sequence[str]]) -> Tuple[str, Dict[str, Any], list]:
    """SQL fragment restricting documents to ``audiences`` (None = unrestricted).

    Legacy documents (audience IS NULL) count as LEGACY_DOC_AUDIENCE. Returns
    (sql, params, bindparams) to splice into a ``WHERE ... AND`` clause.
    """
    if audiences is None:
        return "", {}, []
    return (
        " AND COALESCE(audience, :legacy_audience) IN :audiences",
        {"legacy_audience": legacy_doc_audience(), "audiences": list(audiences)},
        [bindparam("audiences", expanding=True)],
    )

def _embedding_to_pgvector_literal(embedding: List[float]) -> str:
    return "[" + ",".join(str(x) for x in embedding) + "]"

def semantic_search(
    query: str, tenant_id: str, limit: int = 5, audiences: Optional[Sequence[str]] = None
) -> List[Tuple]:
    """Top-``limit`` chunks of the tenant by cosine distance, restricted to ``audiences``
    (None = every audience, i.e. an admin)."""
    db = None
    try:
        db = SessionLocal()
        embedding = generate_embedding(query)
        embedding_literal = _embedding_to_pgvector_literal(embedding)
        audience_sql, audience_params, audience_binds = audience_filter(audiences)

        sql = text(f"""
        SELECT
            id,
            content,
            source_type,
            file_path,
            (embedding <=> CAST(:embedding AS vector)) AS distance
        FROM documents
        WHERE tenant_id = :tenant_id{audience_sql}
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
        """).bindparams(*audience_binds)

        results = db.execute(
            sql,
            {
                "embedding": embedding_literal,
                "tenant_id": tenant_id,
                "limit": limit,
                **audience_params,
            }
        )

        return results.fetchall()
    except Exception as e:
        logger.error(f"Error in semantic_search: {str(e)}")
        return []
    finally:
        if db is not None:
            db.close()

def hybrid_search(
    query: str, tenant_id: str, limit: int = 5, audiences: Optional[Sequence[str]] = None
) -> List[Tuple]:
    db = None
    try:
        db = SessionLocal()
        embedding = generate_embedding(query)
        embedding_literal = _embedding_to_pgvector_literal(embedding)
        audience_sql, audience_params, audience_binds = audience_filter(audiences)

        sql = text(f"""
        SELECT
            id,
            content,
            source_type,
            file_path,
            (embedding <=> CAST(:embedding AS vector)) AS distance
        FROM documents
        WHERE tenant_id = :tenant_id
            AND (content ILIKE :query OR file_path ILIKE :query){audience_sql}
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
        """).bindparams(*audience_binds)

        results = db.execute(
            sql,
            {
                "embedding": embedding_literal,
                "tenant_id": tenant_id,
                "query": f"%{query}%",
                "limit": limit,
                **audience_params,
            }
        )

        return results.fetchall()
    except Exception as e:
        logger.error(f"Error in hybrid_search: {str(e)}")
        return []
    finally:
        if db is not None:
            db.close()
