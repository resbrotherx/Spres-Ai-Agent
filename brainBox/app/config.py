import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME = "Brainbox"
    PROJECT_VERSION = "1.0.0"

    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://brainbox:brainbox123@localhost:5432/spres_ai"
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

    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = 24

    API_KEY_LENGTH = 32

    CHUNK_SIZE = 1024
    CHUNK_OVERLAP = 256

    BATCH_SIZE = 32
    MAX_FILE_SIZE = 50 * 1024 * 1024

    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    DEBUG = os.getenv("DEBUG", "false").lower() == "true"

settings = Settings()
