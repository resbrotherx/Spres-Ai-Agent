from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.ingest import router as ingest_router
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.db.session import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="Brainbox AI Backend",
    description="Production AI backend for REST AI infrastructure",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(ingest_router, prefix="/api", tags=["ingest"])
app.include_router(chat_router, prefix="/api", tags=["chat"])

@app.get("/")
def root():
    return {
        "service": "Brainbox AI Backend",
        "status": "running",
        "version": "1.0.0"
    }
