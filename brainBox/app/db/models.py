from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, Index, UniqueConstraint
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

from app.db.base import Base
from app.config import settings

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    source_type = Column(String, index=True, nullable=False)
    file_path = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    content_hash = Column(String, unique=True, index=True, nullable=False)
    embedding = Column(Vector(settings.VECTOR_DIM), nullable=True)
    doc_metadata = Column(Text, nullable=True)
    # Training source that produced this chunk (NULL for legacy /api/ingest documents)
    source_id = Column(String, index=True, nullable=True)
    # Who may retrieve this chunk: public | customer | vendor | internal | admin.
    # NULL = legacy document, treated as settings.LEGACY_DOC_AUDIENCE.
    audience = Column(String, index=True, nullable=True)
    # How the audience was decided: source (training source) | auto (labeller) | staff (dashboard).
    audience_origin = Column(String, nullable=True)
    audience_reason = Column(String, nullable=True)  # short explanation of an automatic label
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_tenant_source', 'tenant_id', 'source_type'),
        Index('idx_tenant_hash', 'tenant_id', 'content_hash'),
    )

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # --- staff dashboard accounts (tenant_id + role set). Legacy /api/auth users leave them NULL.
    # Emails are unique globally: one staff account per email address (username = email).
    tenant_id = Column(String, index=True, nullable=True)
    full_name = Column(String, nullable=True)
    role = Column(String, nullable=True)  # owner | admin | trainer | viewer
    notify_email = Column(Boolean, default=True)
    notify_in_app = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    invite_token_hash = Column(String, index=True, nullable=True)  # set while an invite is pending
    invite_expires_at = Column(DateTime(timezone=True), nullable=True)
    reset_token_hash = Column(String, index=True, nullable=True)
    reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    # Platform admins (Brainbox operators) can manage every tenant via /api/platform/*.
    is_platform_admin = Column(Boolean, default=False, nullable=True)
    # Set when an admin chose the password (temporary): the dashboard forces a change at login.
    must_change_password = Column(Boolean, default=False, nullable=True)

class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # legacy; 0 for keys made by the admin API/CLI
    tenant_id = Column(String, index=True, nullable=False)
    key_hash = Column(String, unique=True, index=True, nullable=False)  # SHA-256 of the raw key
    name = Column(String, nullable=False)
    # publishable (pk_live_..., browser-safe, chat only) | secret (sk_live_..., server-side, everything).
    # NULL (keys created before key types existed) is treated as publishable.
    key_type = Column(String, nullable=True)
    key_prefix = Column(String, nullable=True)  # first characters of the raw key, for display only
    # Encrypted copy so an admin can reveal/share the key later (app/secretbox.py). NULL for keys
    # created before this existed: those can only be rolled.
    key_encrypted = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    last_used = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

class ProcessingTask(Base):
    __tablename__ = "processing_tasks"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    task_id = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, index=True, default="pending")
    source_type = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(Integer, nullable=True)  # legacy, unused
    session_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=True)
    # Integrator-supplied end user (e.g. "odoo:mydb:7"). NULL = tenant-wide session (legacy clients).
    external_user_id = Column(String, index=True, nullable=True)
    user_name = Column(String, nullable=True)
    user_role = Column(String, nullable=True)  # admin | internal | portal | customer | vendor | public
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    tenant_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TrainingSource(Base):
    """A file, text snippet or third-party API the bot has been trained on."""
    __tablename__ = "training_sources"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String, unique=True, index=True, nullable=False)
    tenant_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    kind = Column(String, nullable=False)  # file | api | text
    source_type = Column(String, nullable=False)  # pdf, xml, support_tickets, ...
    filename = Column(String, nullable=True)
    url = Column(Text, nullable=True)
    config = Column(Text, nullable=True)  # JSON (unredacted; redact before returning)
    # Audience copied onto every document of this source (NULL = legacy, see LEGACY_DOC_AUDIENCE).
    audience = Column(String, nullable=True, default="internal")
    status = Column(String, index=True, nullable=False, default="queued")
    documents_count = Column(Integer, nullable=False, default=0)
    records_count = Column(Integer, nullable=False, default=0)
    last_task_id = Column(String, nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------------------------
# Staff dashboard: knowledge gaps, chat analytics, feedback, notifications, settings, email log
# ---------------------------------------------------------------------------------------------

class KnowledgeGap(Base):
    """A question the bot couldn't answer well. Grouped per tenant by normalized question text."""
    __tablename__ = "knowledge_gaps"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    question = Column(Text, nullable=False)
    question_norm = Column(Text, nullable=False)
    question_hash = Column(String, nullable=False)  # sha256(question_norm), unique per tenant
    reason = Column(String, index=True, nullable=False)
    status = Column(String, index=True, nullable=False, default="open")  # open | resolved | dismissed
    occurrences = Column(Integer, nullable=False, default=1)
    best_distance = Column(Float, nullable=True)
    answer_given = Column(Text, nullable=True)
    session_id = Column(String, index=True, nullable=True)
    user_id = Column(String, nullable=True)  # external end-user id
    user_name = Column(String, nullable=True)
    user_role = Column(String, nullable=True)
    resolution_note = Column(Text, nullable=True)
    resolved_by_id = Column(Integer, nullable=True)
    resolved_by_name = Column(String, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    source_id = Column(String, nullable=True)  # training source created from the staff answer
    last_feedback_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (UniqueConstraint("tenant_id", "question_hash", name="uq_gap_tenant_question"),)


class ChatEvent(Base):
    """One row per question asked in /api/chat (analytics: answer rate, daily chart, top questions)."""
    __tablename__ = "chat_events"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=True)
    message_id = Column(Integer, index=True, nullable=True)  # assistant message
    user_role = Column(String, nullable=True)
    question = Column(Text, nullable=True)
    question_norm = Column(Text, nullable=True)
    answered = Column(Boolean, nullable=False, default=True)
    gap_reason = Column(String, nullable=True)
    cached = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (Index("ix_chat_events_tenant_created", "tenant_id", "created_at"),)


class ChatFeedback(Base):
    __tablename__ = "chat_feedback"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=False)
    message_id = Column(Integer, unique=True, index=True, nullable=False)  # assistant message
    rating = Column(String, nullable=False)  # up | down
    comment = Column(Text, nullable=True)
    gap_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False)  # staff user (users.id)
    type = Column(String, nullable=False)  # gap | feedback | training_failed | staff
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    link = Column(String, nullable=True)
    read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class TenantSettings(Base):
    __tablename__ = "tenant_settings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=True)
    support_email = Column(String, nullable=True)
    gap_distance_threshold = Column(Float, nullable=True)
    notify_on_gap = Column(Boolean, nullable=True)
    notify_on_feedback = Column(Boolean, nullable=True)
    email_max_per_hour = Column(Integer, nullable=True)
    widget = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EmailLog(Base):
    """Outgoing emails; notification emails drive the per-tenant hourly throttle."""
    __tablename__ = "email_log"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=True)
    to_email = Column(String, nullable=False)
    kind = Column(String, nullable=False)  # gap | feedback | training_failed | staff | invite | reset
    subject = Column(String, nullable=True)
    status = Column(String, nullable=False)  # sent | failed | throttled
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
