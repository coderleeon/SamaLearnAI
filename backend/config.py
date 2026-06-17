"""Application configuration loaded from environment variables."""

from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

# Resolve .env relative to this file (backend/.env)
_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    """Central configuration for the backend application.

    All values are loaded from environment variables or a .env file.
    """

    # --- Supabase ---
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str  # Use the service_role key (bypasses RLS)

    # --- Google Gemini ---
    GOOGLE_API_KEY: str | None = None
    GEMINI_CHAT_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIMENSIONS: int = 3072

    # --- OpenRouter ---
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_CHAT_MODEL: str = "google/gemini-2.5-flash"


    # --- RAG Configuration ---
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 50
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_THRESHOLD: float = 0.3

    # --- Server ---
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {
        "env_file": str(_ENV_FILE),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton of the application settings."""
    return Settings()
