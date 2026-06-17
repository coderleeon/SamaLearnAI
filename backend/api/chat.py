"""Streaming chat API endpoint for the Learning Assistant.

Uses Server-Sent Events (SSE) to stream LLM responses token-by-token
through the LangGraph learning workflow.
"""

import json
import asyncio
from queue import Queue, Empty
from threading import Thread

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from backend.services.models import ChatRequest
from backend.agents.learning_graph import learning_graph

router = APIRouter()


@router.post("/chat")
async def stream_chat(body: ChatRequest):
    """Stream a chat response using SSE.

    The LangGraph runs synchronously in a background thread while
    tokens are streamed to the client via an async SSE generator.

    SSE Event Types:
        - "token": A chunk of the LLM's response text
        - "citations": JSON array of citation objects
        - "done": Signal that the stream is complete
        - "error": An error occurred
    """
    session_id = body.session_id
    message = body.message

    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    async def event_generator():
        token_queue: Queue[str | None] = Queue()
        result_holder: list[dict] = [{}]
        error_holder: list[Exception | None] = [None]

        def stream_callback(token: str):
            """Called by the LangGraph generate_answer node for each token."""
            token_queue.put(token)

        def run_graph():
            """Run the LangGraph in a background thread."""
            try:
                result = learning_graph.invoke({
                    "session_id": session_id,
                    "user_message": message,
                    "stream_callback": stream_callback,
                })
                result_holder[0] = result
            except Exception as e:
                error_holder[0] = e
            finally:
                token_queue.put(None)  # Signal completion

        # Start graph execution in background thread
        thread = Thread(target=run_graph, daemon=True)
        thread.start()

        # Stream tokens as they arrive
        try:
            while True:
                try:
                    # Non-blocking check with short timeout
                    token = token_queue.get(timeout=0.05)
                except Empty:
                    # Yield control to the event loop
                    await asyncio.sleep(0.01)
                    continue

                if token is None:
                    # Graph execution completed
                    break

                yield {
                    "event": "token",
                    "data": json.dumps({"text": token}),
                }

            # Wait for thread to finish
            thread.join(timeout=5.0)

            # Check for errors
            if error_holder[0]:
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "error": str(error_holder[0]),
                    }),
                }
                return

            # Send citations
            result = result_holder[0]
            citations = result.get("citations", [])
            if citations:
                yield {
                    "event": "citations",
                    "data": json.dumps(citations),
                }

            # Send completion signal
            yield {
                "event": "done",
                "data": json.dumps({"status": "complete"}),
            }

        except asyncio.CancelledError:
            # Client disconnected
            return

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """Get all messages for a session (for restoring chat history on page load)."""
    from backend.services.supabase import get_supabase_client

    supabase = get_supabase_client()
    result = (
        supabase.table("messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return result.data or []
