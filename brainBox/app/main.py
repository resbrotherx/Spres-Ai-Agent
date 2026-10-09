from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.ingest import router as ingest_router
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.upload import router as upload_router
from app.api.train import router as train_router
from app.api.admin import router as admin_router
from app.api.staff import router as staff_router
from app.api.reports import router as reports_router
from app.api.dashboard import router as dashboard_router
from app.api.platform import router as platform_router
from app.config import settings
from app.db.session import init_db
from app.permissions import AUDIENCES
from app.utils.logging import logger


def _startup_checks() -> None:
    if not settings.REQUIRE_API_KEY:
        logger.warning(
            "REQUIRE_API_KEY=false: API keys are NOT enforced. tenant_id and user_role are taken "
            "from the request. Set REQUIRE_API_KEY=true once every client has a key."
        )
    if not settings.BRAINBOX_ADMIN_TOKEN:
        logger.warning("BRAINBOX_ADMIN_TOKEN is not set: /api/admin/keys is disabled (use `python -m app.cli keys ...`).")
    elif len(settings.BRAINBOX_ADMIN_TOKEN) < 32:
        logger.warning("BRAINBOX_ADMIN_TOKEN is shorter than 32 characters; use a long random value.")
    from app.staff import jwt_secret_is_placeholder
    if jwt_secret_is_placeholder():
        logger.warning(
            "!!! JWT_SECRET_KEY is empty, too short or the .env.example placeholder. Staff dashboard "
            "logins are signed with it, so anyone who knows it can forge staff sessions. Set a long "
            "random value, e.g. python -c \"import secrets; print(secrets.token_urlsafe(48))\" !!!"
        )
    from app.notify.email import smtp_configured
    if not smtp_configured():
        logger.info("SMTP is not configured (SMTP_HOST/SMTP_FROM): notification, invite and reset emails are disabled.")
    if not settings.DASHBOARD_URL:
        logger.info("DASHBOARD_URL is not set: invite/reset links use the request Origin header.")
    if settings.LEGACY_DOC_AUDIENCE not in AUDIENCES:
        logger.warning(f"LEGACY_DOC_AUDIENCE={settings.LEGACY_DOC_AUDIENCE!r} is not a valid audience; using 'public'.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _startup_checks()
    # Load the LLM into memory in the background so the first question isn't a cold start.
    import threading
    from app.llm.ollama_client import warm_up_ollama
    threading.Thread(target=warm_up_ollama, name="ollama-warmup", daemon=True).start()
    yield

app = FastAPI(
    title="Brainbox AI Backend",
    description="Production AI backend for REST AI infrastructure",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    # allow_origins=[
    #     "http://localhost:4173",
    #     "http://127.0.0.1:4173",
    #     "http://localhost:5173",
    #     "http://127.0.0.1:5173",
    #     "http://165.227.77.33:8000",
    #     "http://165.227.77.33",
    #     "https://165.227.77.33",
    #     "http://port.smartpowerbilling.com",
    #     "https://port.smartpowerbilling.com",
    # ],
    allow_origins=["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$",
    # Keys travel in headers (X-API-Key / Authorization), never cookies: credentials off keeps
    # the wildcard origin valid and stops browsers from attaching ambient credentials.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(ingest_router, prefix="/api", tags=["ingest"])
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(upload_router, prefix="/api", tags=["upload"])
app.include_router(train_router, prefix="/api", tags=["train"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(staff_router, prefix="/api", tags=["staff"])
app.include_router(reports_router, prefix="/api", tags=["reports"])
app.include_router(dashboard_router, prefix="/api", tags=["dashboard"])
app.include_router(platform_router, prefix="/api/platform", tags=["platform"])

@app.get("/")
def root():
    return {
        "service": "Brainbox AI Backend",
        "status": "running",
        "version": "1.0.0"
    }
