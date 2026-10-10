import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME = "Brainbox"
    PROJECT_VERSION = "1.0.0"

    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://spres:spres@localhost:5432/spres_ai"
    )

    REDIS_URL = os.getenv(
        "REDIS_URL",
        "redis://localhost:6379/0"
    )

    CELERY_BROKER_URL = os.getenv(
        "CELERY_BROKER_URL",
        "redis://localhost:6379/0"
    )

    CELERY_RESULT_BACKEND = os.getenv(
        "CELERY_RESULT_BACKEND",
        "redis://localhost:6379/0"
    )

    OLLAMA_BASE_URL = os.getenv(
        "OLLAMA_BASE_URL",
        "http://localhost:11434"
    )

    OLLAMA_MODEL = os.getenv(
        "OLLAMA_MODEL",
        "llama2"
    )

    EMBEDDING_MODEL = os.getenv(
        "EMBEDDING_MODEL",
        "BAAI/bge-base-en-v1.5"
    )

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", None)

    USE_OPENAI = os.getenv("USE_OPENAI", "false").lower() == "true"

    # --- Answer speed / LLM tuning -------------------------------------------------------
    # LLM_PROVIDER: "ollama" (local, default) or "openai" (any OpenAI-compatible API — OpenAI,
    # Groq, Together… — set OPENAI_API_KEY, OPENAI_BASE_URL and OPENAI_MODEL). The other
    # provider is still tried as a fallback when configured.
    LLM_PROVIDER = (os.getenv("LLM_PROVIDER") or "ollama").strip().lower()
    OPENAI_BASE_URL = (os.getenv("OPENAI_BASE_URL") or "").strip() or None
    OPENAI_MODEL = (os.getenv("OPENAI_MODEL") or "gpt-4o-mini").strip()
    # Ollama: keep these constant — changing num_ctx between requests forces a slow model reload.
    OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "2048") or 2048)
    OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "220") or 220)  # max answer tokens
    OLLAMA_NUM_THREAD = int(os.getenv("OLLAMA_NUM_THREAD", "0") or 0)  # 0 = let Ollama decide
    OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "-1")  # -1 = keep the model in memory
    OLLAMA_WARMUP = os.getenv("OLLAMA_WARMUP", "true").lower() not in ("0", "false", "no", "off")
    LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.2") or 0.2)
    LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "120") or 120)
    # How much knowledge-base text goes into each prompt (prompt size dominates CPU latency).
    RAG_MAX_CHUNKS = int(os.getenv("RAG_MAX_CHUNKS", "3") or 3)
    RAG_MAX_CHUNK_CHARS = int(os.getenv("RAG_MAX_CHUNK_CHARS", "700") or 700)

    VECTOR_DIM = 768

    # Encrypts the copy of each API key that admins can reveal later (defaults to JWT_SECRET_KEY).
    KEY_ENCRYPTION_SECRET = (os.getenv("KEY_ENCRYPTION_SECRET") or "").strip() or None
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "your-secret-key-change-in-production"
    )
    JWT_PLACEHOLDER_SECRETS = ("", "your-secret-key-change-in-production", "change-me", "secret")

    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = 24

    API_KEY_LENGTH = 32

    CHUNK_SIZE = 1024
    CHUNK_OVERLAP = 256

    BATCH_SIZE = 32
    MAX_FILE_SIZE = 50 * 1024 * 1024

    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    DEBUG = os.getenv("DEBUG", "false").lower() == "true"

    # --- API keys & permissions -------------------------------------------------------------
    # Kill switch: when false every endpoint behaves as before keys existed (tenant_id and
    # user_role are taken from the request). Logged as a warning at startup.
    REQUIRE_API_KEY = os.getenv("REQUIRE_API_KEY", "true").strip().lower() not in ("0", "false", "no", "off")

    # Long random token guarding /api/admin/keys (X-Admin-Token header). Unset = admin API disabled.
    BRAINBOX_ADMIN_TOKEN = (os.getenv("BRAINBOX_ADMIN_TOKEN") or "").strip() or None

    # Audience assumed for documents ingested before audiences existed (documents.audience IS NULL).
    LEGACY_DOC_AUDIENCE = os.getenv("LEGACY_DOC_AUDIENCE", "public").strip().lower() or "public"
    # Label those legacy documents automatically (rules + the local model) once after startup.
    # Time zone the assistant uses for "good morning" and "what time is it".
    ASSISTANT_TIMEZONE = os.getenv("ASSISTANT_TIMEZONE", "Africa/Lagos")
    KNOWLEDGE_AUTO_LABEL = os.getenv("KNOWLEDGE_AUTO_LABEL", "true").lower() not in ("0", "false", "no", "off")
    KNOWLEDGE_LABEL_USE_AI = os.getenv("KNOWLEDGE_LABEL_USE_AI", "true").lower() not in ("0", "false", "no", "off")
    # Pause between AI-labelled chunks so live chats get the model in between.
    KNOWLEDGE_LABEL_PAUSE_S = float(os.getenv("KNOWLEDGE_LABEL_PAUSE_S", "1.0") or 1.0)

    # --- Staff dashboard ---------------------------------------------------------------------
    # Staff JWTs are signed with JWT_SECRET_KEY (HS256); a placeholder secret logs a loud warning.
    STAFF_JWT_HOURS = int(os.getenv("STAFF_JWT_HOURS", "12") or 12)
    # Failed staff logins allowed per email+IP within the window (in-memory: per worker process).
    LOGIN_MAX_FAILURES = int(os.getenv("LOGIN_MAX_FAILURES", "10") or 10)
    LOGIN_WINDOW_MINUTES = int(os.getenv("LOGIN_WINDOW_MINUTES", "15") or 15)
    # Base URL of the staff dashboard used in invite / password-reset links (no trailing slash).
    DASHBOARD_URL = (os.getenv("DASHBOARD_URL") or "").strip().rstrip("/") or None

    # Knowledge-gap defaults (each tenant can override them in /api/settings).
    GAP_DISTANCE_THRESHOLD = float(os.getenv("GAP_DISTANCE_THRESHOLD", "0.55") or 0.55)
    EMAIL_MAX_PER_HOUR = int(os.getenv("EMAIL_MAX_PER_HOUR", "20") or 20)

    # --- Outgoing email (notifications, invites, password resets). Unset SMTP_HOST = no email.
    SMTP_HOST = (os.getenv("SMTP_HOST") or "").strip() or None
    SMTP_PORT = int(os.getenv("SMTP_PORT", "0") or 0)  # 0 = 587 (starttls) / 465 (ssl) / 25 (none)
    SMTP_USER = (os.getenv("SMTP_USER") or "").strip() or None
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD") or None
    SMTP_FROM = (os.getenv("SMTP_FROM") or "").strip() or None
    SMTP_TLS = (os.getenv("SMTP_TLS") or "starttls").strip().lower()  # starttls | ssl | none
    SMTP_TIMEOUT = int(os.getenv("SMTP_TIMEOUT", "15") or 15)

    # --- Realtime (SSE: /api/chat/stream, /api/staff/events) --------------------------------
    # Comment heartbeat interval (keeps proxies from closing idle streams).
    SSE_PING_SECONDS = float(os.getenv("SSE_PING_SECONDS", "15") or 15)
    # Minimum interval between "overview" count pushes per tenant.
    REALTIME_OVERVIEW_SECONDS = float(os.getenv("REALTIME_OVERVIEW_SECONDS", "10") or 10)
    # Events buffered per connected dashboard before new ones are dropped (slow consumers).
    REALTIME_QUEUE_SIZE = int(os.getenv("REALTIME_QUEUE_SIZE", "256") or 256)
    # How often a live staff stream re-checks that its user/JWT is still valid.
    REALTIME_REAUTH_SECONDS = float(os.getenv("REALTIME_REAUTH_SECONDS", "300") or 300)

settings = Settings()
