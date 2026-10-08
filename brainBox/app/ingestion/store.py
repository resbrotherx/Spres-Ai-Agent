"""Robust bulk insert of embedded chunks into the ``documents`` table.

- de-duplicates hashes within the run and against the table (content_hash is globally unique)
- embeds in batches (one model.encode call per batch, per-item fallback on failure)
- inserts each row inside a SAVEPOINT so one IntegrityError never poisons the session
"""
import json
from typing import Any, Dict, List, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Document
from app.utils.logging import logger

EMBED_BATCH_SIZE = 32


def _embed(texts: List[str]) -> List[Any]:
    from app.embeddings.generator import generate_embedding, generate_embeddings_batch
    try:
        return generate_embeddings_batch(texts)
    except Exception as e:
        logger.warning(f"Batch embedding failed ({e}); falling back to one-by-one")
        out = []
        for t in texts:
            try:
                out.append(generate_embedding(t))
            except Exception as inner:
                logger.error(f"Embedding failed for chunk: {inner}")
                out.append(None)
        return out


def existing_hashes(db: Session, hashes: List[str]) -> set:
    found = set()
    for i in range(0, len(hashes), 500):
        part = hashes[i:i + 500]
        found.update(h for (h,) in db.query(Document.content_hash).filter(Document.content_hash.in_(part)))
    return found


def store_documents(db: Session, rows: List[Dict[str, Any]]) -> Tuple[int, int, int]:
    """Insert rows: dicts with tenant_id, source_type, content, content_hash and optional
    file_path, source_id, audience, metadata (dict). Returns (added, skipped_duplicates, errors)."""
    seen = set()
    unique_rows = []
    skipped = 0
    for r in rows:
        if not r["content"].strip() or r["content_hash"] in seen:
            skipped += 1
            continue
        seen.add(r["content_hash"])
        unique_rows.append(r)

    already = existing_hashes(db, [r["content_hash"] for r in unique_rows])
    todo = [r for r in unique_rows if r["content_hash"] not in already]
    skipped += len(unique_rows) - len(todo)

    added = errors = 0
    for start in range(0, len(todo), EMBED_BATCH_SIZE):
        batch = todo[start:start + EMBED_BATCH_SIZE]
        embeddings = _embed([r["content"] for r in batch])
        for row, emb in zip(batch, embeddings):
            if emb is None:
                errors += 1
                continue
            doc = Document(
                tenant_id=row["tenant_id"],
                source_type=row["source_type"],
                file_path=row.get("file_path"),
                content=row["content"],
                content_hash=row["content_hash"],
                embedding=emb,
                doc_metadata=json.dumps(row.get("metadata") or {}, default=str),
                source_id=row.get("source_id"),
                audience=row.get("audience"),
            )
            try:
                with db.begin_nested():
                    db.add(doc)
                added += 1
            except IntegrityError:
                # inserted concurrently by someone else: treat as duplicate
                skipped += 1
            except Exception as e:
                logger.error(f"Failed to insert document: {e}")
                errors += 1
        db.commit()
    return added, skipped, errors
