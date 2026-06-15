"""Supabase client singleton.

Provides a configured async-ready Supabase client for use across the backend.
Uses the service_role key to bypass RLS for server-side operations.
"""

from supabase import create_client, Client
from backend.config import get_settings

_client: Client | None = None


def get_supabase_client() -> Client:
    """Return a cached Supabase client instance."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = create_client(
            supabase_url=settings.SUPABASE_URL,
            supabase_key=settings.SUPABASE_SERVICE_KEY,
        )
    return _client
