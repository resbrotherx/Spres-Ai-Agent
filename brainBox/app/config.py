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

    VECTOR_DIM = 768

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

settings = Settings()
