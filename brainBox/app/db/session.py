import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.base import Base

_log = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    echo=settings.DEBUG
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_ddl(statement: str) -> None:
    """Run one idempotent DDL statement in its own transaction; log (don't raise) on failure."""
    try:
        with engine.begin() as conn:
            conn.execute(text(statement))
    except Exception as e:  # e.g. missing privileges
        _log.warning(f"init_db: could not run '{statement}': {e}")


def init_db(reset_interrupted: bool = True):
    """Create/upgrade the schema. ``reset_interrupted`` marks queued/processing training jobs as
    failed (they die with the server process); the CLI passes False so it never touches live jobs."""
    # pgvector must exist before the documents table (Vector column) is created.
    _run_ddl("CREATE EXTENSION IF NOT EXISTS vector")

    # Import models so every table is registered on Base.metadata.
    from app.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # create_all() never alters existing tables: add newer columns idempotently.
    _run_ddl("ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_id VARCHAR")
    _run_ddl("CREATE INDEX IF NOT EXISTS ix_documents_source_id ON documents (source_id)")
    # Per-user chat sessions (external integrator user ids).
    _run_ddl("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS external_user_id VARCHAR")
    _run_ddl("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_name VARCHAR")
    _run_ddl("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_role VARCHAR")
    _run_ddl("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE")
    _run_ddl("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE")
    _run_ddl(
        "CREATE INDEX IF NOT EXISTS ix_chat_sessions_external_user_id "
        "ON chat_sessions (external_user_id)"
    )

    # API key types + audience-based permissions.
    _run_ddl("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_type VARCHAR")
    _run_ddl("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix VARCHAR")
    _run_ddl("ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_encrypted TEXT")
    _run_ddl("ALTER TABLE documents ADD COLUMN IF NOT EXISTS audience VARCHAR")
    _run_ddl("CREATE INDEX IF NOT EXISTS ix_documents_audience ON documents (audience)")
    _run_ddl("ALTER TABLE training_sources ADD COLUMN IF NOT EXISTS audience VARCHAR")
    _run_ddl("ALTER TABLE documents ADD COLUMN IF NOT EXISTS audience_origin VARCHAR")
    _run_ddl("ALTER TABLE documents ADD COLUMN IF NOT EXISTS audience_reason VARCHAR")

    # Staff dashboard accounts live in `users` (new tables are created by create_all above).
    # (SQLite has no ADD COLUMN IF NOT EXISTS; its databases are created fresh by create_all.)
    for column, ddl in () if engine.dialect.name == "sqlite" else (
        ("tenant_id", "VARCHAR"),
        ("full_name", "VARCHAR"),
        ("role", "VARCHAR"),
        ("notify_email", "BOOLEAN DEFAULT TRUE"),
        ("notify_in_app", "BOOLEAN DEFAULT TRUE"),
        ("last_login_at", "TIMESTAMP WITH TIME ZONE"),
        ("invite_token_hash", "VARCHAR"),
        ("invite_expires_at", "TIMESTAMP WITH TIME ZONE"),
        ("reset_token_hash", "VARCHAR"),
        ("reset_expires_at", "TIMESTAMP WITH TIME ZONE"),
        ("is_platform_admin", "BOOLEAN DEFAULT FALSE"),
        ("must_change_password", "BOOLEAN DEFAULT FALSE"),
    ):
        _run_ddl(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column} {ddl}")
    _run_ddl("CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users (tenant_id)")
    _run_ddl("CREATE INDEX IF NOT EXISTS ix_users_invite_token_hash ON users (invite_token_hash)")
    _run_ddl("CREATE INDEX IF NOT EXISTS ix_users_reset_token_hash ON users (reset_token_hash)")

    if not reset_interrupted:
        return

    # Background tasks die with the process; don't leave sources stuck "processing" forever.
    _run_ddl(
        "UPDATE processing_tasks SET status = 'failed', "
        "error_message = 'Interrupted by a server restart' "
        "WHERE status IN ('queued', 'processing') AND task_id IN ("
        "SELECT last_task_id FROM training_sources WHERE status IN ('queued', 'processing'))"
    )
    _run_ddl(
        "UPDATE training_sources SET status = 'failed', "
        "error_message = 'Interrupted by a server restart. Please sync or upload again.' "
        "WHERE status IN ('queued', 'processing')"
    )
