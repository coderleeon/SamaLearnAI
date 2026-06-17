"""Source upload and processing API routes.

Handles file uploads (PDF, PPTX) and URL submissions (YouTube, Website).
Parses content, chunks it, generates embeddings, and stores in Supabase.
"""

import traceback
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from backend.services.supabase import get_supabase_client
from backend.services.models import SourceUploadResponse, SourceStatusResponse
from backend.parsers.pdf_parser import parse_pdf
from backend.rag.chunker import chunk_pages
from backend.rag.embedder import embed_texts
from backend.rag.retriever import store_chunks

router = APIRouter()


# ---------------------------------------------------------------------------
# File upload (PDF, PPTX)
# ---------------------------------------------------------------------------

@router.post("/sources/upload", response_model=SourceUploadResponse)
async def upload_source(
    file: UploadFile = File(...),
    session_id: str = Form(...),
):
    """Upload a file (PDF or PPTX) and process it for RAG.

    The file is parsed, chunked, embedded, and stored in a single request.
    For production, this would be async/background, but synchronous is
    simpler and sufficient for the demo.
    """
    # Determine source type from extension
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        source_type = "pdf"
    elif ext in ("pptx", "ppt"):
        source_type = "pptx"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Supported: .pdf, .pptx",
        )

    supabase = get_supabase_client()

    # Create source record (status: processing)
    source_result = (
        supabase.table("sources")
        .insert({
            "session_id": session_id,
            "source_type": source_type,
            "name": filename,
            "status": "processing",
            "metadata": {},
        })
        .execute()
    )

    if not source_result.data:
        raise HTTPException(status_code=500, detail="Failed to create source record")

    source_id = source_result.data[0]["id"]

    try:
        # Read file bytes
        file_bytes = await file.read()

        # Parse based on type
        if source_type == "pdf":
            pages = parse_pdf(file_bytes, filename)
            source_meta = {
                "page_count": len(pages),
                "file_size_bytes": len(file_bytes),
            }
        elif source_type == "pptx":
            # PPTX parser will be added in Phase 3 — for now, fail gracefully
            raise HTTPException(status_code=501, detail="PPTX parsing coming in Phase 3")
        else:
            raise HTTPException(status_code=400, detail="Unsupported source type")

        # Chunk the pages
        chunks = chunk_pages(pages)

        if not chunks:
            raise ValueError("No content could be extracted from the file")

        # Generate embeddings
        texts = [c["content"] for c in chunks]
        embeddings = embed_texts(texts)

        # Store chunks + embeddings in Supabase
        stored_count = store_chunks(source_id, chunks, embeddings)

        # Update source status to ready
        supabase.table("sources").update({
            "status": "ready",
            "metadata": {
                **source_meta,
                "chunk_count": stored_count,
            },
        }).eq("id", source_id).execute()

        return SourceUploadResponse(
            id=source_id,
            session_id=session_id,
            source_type=source_type,
            name=filename,
            status="ready",
            metadata={**source_meta, "chunk_count": stored_count},
        )

    except HTTPException:
        raise
    except Exception as e:
        # Mark source as error
        supabase.table("sources").update({
            "status": "error",
            "metadata": {"error": str(e)},
        }).eq("id", source_id).execute()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


# ---------------------------------------------------------------------------
# URL submission (YouTube, Website)
# ---------------------------------------------------------------------------

class UrlSourceRequest(BaseModel):
    session_id: str
    url: str
    source_type: str  # "youtube" or "website"


@router.post("/sources/url", response_model=SourceUploadResponse)
async def add_url_source(body: UrlSourceRequest):
    """Add a URL source (YouTube or Website) and process it for RAG."""
    if body.source_type not in ("youtube", "website"):
        raise HTTPException(
            status_code=400,
            detail="source_type must be 'youtube' or 'website'",
        )

    supabase = get_supabase_client()

    # Create source record
    source_result = (
        supabase.table("sources")
        .insert({
            "session_id": body.session_id,
            "source_type": body.source_type,
            "name": body.url,
            "status": "processing",
            "metadata": {"url": body.url},
        })
        .execute()
    )

    if not source_result.data:
        raise HTTPException(status_code=500, detail="Failed to create source record")

    source_id = source_result.data[0]["id"]

    try:
        # YouTube and Website parsers will be added in Phase 3
        # For now, return a placeholder
        raise HTTPException(
            status_code=501,
            detail=f"{body.source_type} parsing coming in Phase 3",
        )

    except HTTPException:
        supabase.table("sources").update({
            "status": "error",
            "metadata": {"error": "Parser not yet implemented"},
        }).eq("id", source_id).execute()
        raise


# ---------------------------------------------------------------------------
# Source status
# ---------------------------------------------------------------------------

@router.get("/sources/{source_id}", response_model=SourceStatusResponse)
async def get_source_status(source_id: str):
    """Get the processing status of a source."""
    supabase = get_supabase_client()
    result = (
        supabase.table("sources")
        .select("*")
        .eq("id", source_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Source not found")

    row = result.data[0]
    return SourceStatusResponse(
        id=row["id"],
        status=row["status"],
        name=row["name"],
        source_type=row["source_type"],
        summary=row.get("summary"),
        metadata=row.get("metadata"),
    )


@router.get("/sessions/{session_id}/sources")
async def list_session_sources(session_id: str):
    """List all sources for a session."""
    supabase = get_supabase_client()
    result = (
        supabase.table("sources")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return [
        SourceStatusResponse(
            id=row["id"],
            status=row["status"],
            name=row["name"],
            source_type=row["source_type"],
            summary=row.get("summary"),
            metadata=row.get("metadata"),
        )
        for row in (result.data or [])
    ]
