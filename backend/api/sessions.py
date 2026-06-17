"""Session management API routes.

Provides CRUD operations for learning and course planning sessions.
"""

from fastapi import APIRouter, HTTPException
from backend.services.supabase import get_supabase_client
from backend.services.models import SessionCreate, SessionResponse

router = APIRouter()


@router.post("/sessions", response_model=SessionResponse)
async def create_session(body: SessionCreate):
    """Create a new session for learning or course planning."""
    supabase = get_supabase_client()
    result = (
        supabase.table("sessions")
        .insert({
            "task_type": body.task_type,
            "title": body.title,
        })
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")

    row = result.data[0]
    return SessionResponse(
        id=row["id"],
        task_type=row["task_type"],
        title=row.get("title"),
        created_at=row["created_at"],
    )


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """Get a session by ID."""
    supabase = get_supabase_client()
    result = (
        supabase.table("sessions")
        .select("*")
        .eq("id", session_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    row = result.data[0]
    return SessionResponse(
        id=row["id"],
        task_type=row["task_type"],
        title=row.get("title"),
        created_at=row["created_at"],
    )
