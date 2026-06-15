"""FastAPI application entry point.

Configures CORS, registers API routers, and provides a health-check endpoint.
Run with: uvicorn backend.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings


# ---------------------------------------------------------------------------
# Lifespan: startup / shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup: validate settings load correctly
    settings = get_settings()
    print(f"[OK] Backend starting | Supabase: {settings.SUPABASE_URL[:30]}...")
    print(f"[OK] Chat model: {settings.GEMINI_CHAT_MODEL}")
    print(f"[OK] Embedding model: {settings.GEMINI_EMBEDDING_MODEL} ({settings.EMBEDDING_DIMENSIONS}d)")
    yield
    # Shutdown
    print("[BYE] Backend shutting down")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SamaSocial AI Assistant",
    description="Multi-Source Learning Assistant & AI Course Planner",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend (common local dev origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint for monitoring and proxy verification."""
    return {
        "status": "healthy",
        "service": "samasocial-ai-backend",
        "version": "0.1.0",
    }


# ---------------------------------------------------------------------------
# Route registration (stubs — routers added in later phases)
# ---------------------------------------------------------------------------

# from backend.api.chat import router as chat_router
# from backend.api.sources import router as sources_router
# from backend.api.courses import router as courses_router
# from backend.api.sessions import router as sessions_router
#
# app.include_router(sessions_router, prefix="/api/v1", tags=["sessions"])
# app.include_router(sources_router, prefix="/api/v1", tags=["sources"])
# app.include_router(chat_router, prefix="/api/v1", tags=["chat"])
# app.include_router(courses_router, prefix="/api/v1", tags=["courses"])
