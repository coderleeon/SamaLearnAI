"""Streaming chat and retrieval endpoints for the Course Planner.

Handles conversational course requirements gathering, initial generation, and refinement.
"""

import json
import asyncio
from queue import Queue, Empty
from threading import Thread

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from backend.services.models import ChatRequest
from backend.agents.course_graph import course_graph
from backend.services.supabase import get_supabase_client

router = APIRouter()


@router.post("/courses/chat")
async def stream_course_chat(body: ChatRequest):
    """Stream course planning chat response using SSE.

    Invokes the course_graph LangGraph in a background thread and uses a
    token-filtering buffer to separate conversational text from the generated JSON plan.

    SSE Event Types:
        - "token": Conversational text
        - "requirements": Updated requirements dictionary
        - "plan": Newly generated or refined course plan (JSON)
        - "done": Session save complete
        - "error": Stream failure
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
            token_queue.put(token)

        def run_graph():
            try:
                result = course_graph.invoke({
                    "session_id": session_id,
                    "user_message": message,
                    "stream_callback": stream_callback,
                })
                result_holder[0] = result
            except Exception as e:
                error_holder[0] = e
            finally:
                token_queue.put(None)  # Complete signal

        # Run graph in background thread
        thread = Thread(target=run_graph, daemon=True)
        thread.start()

        buffer = ""
        separator = "--- JSON:"
        separator_found = False
        json_chunks = []

        try:
            while True:
                try:
                    token = token_queue.get(timeout=0.05)
                except Empty:
                    await asyncio.sleep(0.01)
                    continue

                if token is None:
                    break

                if separator_found:
                    json_chunks.append(token)
                else:
                    buffer += token
                    if separator in buffer:
                        separator_found = True
                        parts = buffer.split(separator, 1)
                        if parts[0]:
                            yield {
                                "event": "token",
                                "data": json.dumps({"text": parts[0]}),
                            }
                        json_chunks.append(parts[1])
                    else:
                        # Yield safe prefix to keep stream active and highly responsive
                        safe_len = len(buffer) - len(separator) - 5
                        if safe_len > 0:
                            yield_text = buffer[:safe_len]
                            buffer = buffer[safe_len:]
                            yield {
                                "event": "token",
                                "data": json.dumps({"text": yield_text}),
                            }

            # Yield remaining buffer if separator wasn't found
            if not separator_found and buffer:
                yield {
                    "event": "token",
                    "data": json.dumps({"text": buffer}),
                }

            # Wait for thread execution to finish
            thread.join(timeout=5.0)

            if error_holder[0]:
                yield {
                    "event": "error",
                    "data": json.dumps({"error": str(error_holder[0])}),
                }
                return

            result = result_holder[0]

            # Send updated requirements
            requirements = result.get("requirements", {})
            if requirements:
                yield {
                    "event": "requirements",
                    "data": json.dumps(requirements),
                }

            # Send completed course plan JSON if present in the final state
            plan = result.get("plan", {})
            if plan and plan.get("course_title"):
                yield {
                    "event": "plan",
                    "data": json.dumps(plan),
                }
            elif separator_found and json_chunks:
                # If plan was generated but parsing failed inside the node, attempt final parsing here
                full_json_str = "".join(json_chunks).strip()
                try:
                    parsed_plan = json.loads(full_json_str)
                    yield {
                        "event": "plan",
                        "data": json.dumps(parsed_plan),
                    }
                except Exception:
                    # In case of malformed JSON, try parsing via regex
                    import re
                    match = re.search(r"\{.*\}", full_json_str, re.DOTALL)
                    if match:
                        try:
                            parsed_plan = json.loads(match.group(0))
                            yield {
                                "event": "plan",
                                "data": json.dumps(parsed_plan),
                            }
                        except Exception:
                            pass

            yield {
                "event": "done",
                "data": json.dumps({"status": "complete"}),
            }

        except asyncio.CancelledError:
            return

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions/{session_id}/course-plan")
async def get_latest_course_plan(session_id: str):
    """Retrieve the latest version of the course plan for a session."""
    supabase = get_supabase_client()
    result = (
        supabase.table("course_plans")
        .select("*")
        .eq("session_id", session_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        # Check if session exists to return standard empty plan
        sess_check = (
            supabase.table("sessions")
            .select("id")
            .eq("id", session_id)
            .execute()
        )
        if not sess_check.data:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"plan": {}, "requirements": {}, "version": 0}

    row = result.data[0]
    return {
        "id": row["id"],
        "session_id": row["session_id"],
        "version": row["version"],
        "plan": row["plan"],
        "requirements": row.get("requirements") or {},
        "created_at": row["created_at"],
    }


@router.get("/sessions/{session_id}/course-plans")
async def get_all_course_plans(session_id: str):
    """Retrieve all saved versions of the course plan for a session."""
    supabase = get_supabase_client()
    result = (
        supabase.table("course_plans")
        .select("id, version, plan, requirements, created_at")
        .eq("session_id", session_id)
        .order("version", desc=True)
        .execute()
    )
    return result.data or []

