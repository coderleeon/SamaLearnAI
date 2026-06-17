"""LangGraph workflow for the Multi-Source Learning Assistant (Task 1).

This graph handles the RAG pipeline:
  User Question -> Retrieve Chunks -> Build Context -> Generate Answer -> Format Citations

It streams the LLM response token-by-token and returns structured citations.
"""

from __future__ import annotations
import json
import httpx
from typing import Any, Optional, Literal


from langgraph.graph import StateGraph, START, END
from typing_extensions import TypedDict

import google.genai as genai
from backend.config import get_settings
from backend.rag.retriever import retrieve_chunks
from backend.services.supabase import get_supabase_client


# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------

class LearningState(TypedDict, total=False):
    """State passed through the learning assistant graph."""
    session_id: str
    user_message: str

    # Retrieved chunks from vector search
    retrieved_chunks: list[dict]

    # Context assembled for the LLM
    context: str

    # Source metadata for citations
    source_map: dict[str, dict]  # source_id -> {name, source_type}

    # LLM output
    answer: str
    citations: list[dict]

    # Chat history (loaded from DB)
    chat_history: list[dict]

    # Streaming callback (not serialized — set at runtime)
    stream_callback: Any


# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------

_genai_client: genai.Client | None = None


def _get_genai_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        settings = get_settings()
        _genai_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _genai_client


# ---------------------------------------------------------------------------
# Node: Load chat history from database
# ---------------------------------------------------------------------------

def load_history(state: LearningState) -> dict:
    """Load the last N messages from the session for conversation memory."""
    supabase = get_supabase_client()
    result = (
        supabase.table("messages")
        .select("role, content")
        .eq("session_id", state["session_id"])
        .order("created_at")
        .limit(20)
        .execute()
    )

    history = [
        {"role": row["role"], "content": row["content"]}
        for row in (result.data or [])
    ]

    return {"chat_history": history}


# ---------------------------------------------------------------------------
# Node: Retrieve relevant chunks
# ---------------------------------------------------------------------------

def retrieve(state: LearningState) -> dict:
    """Embed the user query and retrieve relevant chunks from pgvector."""
    chunks = retrieve_chunks(
        query=state["user_message"],
        session_id=state["session_id"],
    )

    # Build source map for citation resolution
    supabase = get_supabase_client()
    source_ids = list({c["source_id"] for c in chunks})
    source_map = {}

    if source_ids:
        sources_result = (
            supabase.table("sources")
            .select("id, name, source_type")
            .in_("id", source_ids)
            .execute()
        )
        for s in (sources_result.data or []):
            source_map[s["id"]] = {
                "name": s["name"],
                "source_type": s["source_type"],
            }

    return {
        "retrieved_chunks": chunks,
        "source_map": source_map,
    }


# ---------------------------------------------------------------------------
# Node: Build context from retrieved chunks
# ---------------------------------------------------------------------------

def build_context(state: LearningState) -> dict:
    """Assemble numbered context from retrieved chunks for the LLM prompt."""
    chunks = state.get("retrieved_chunks", [])

    if not chunks:
        return {"context": "No relevant content found in the uploaded sources."}

    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        meta = chunk.get("metadata", {})
        source_id = chunk.get("source_id", "")
        source_info = state.get("source_map", {}).get(source_id, {})
        source_name = source_info.get("name", "Unknown")
        source_type = source_info.get("source_type", "unknown")

        # Build citation label
        label = _build_citation_label(source_type, source_name, meta)

        context_parts.append(
            f"[Source {i}] ({label}):\n{chunk['content']}"
        )

    context = "\n\n---\n\n".join(context_parts)
    return {"context": context}


def _build_citation_label(source_type: str, source_name: str, meta: dict) -> str:
    """Build a human-readable citation label from source metadata."""
    if source_type == "pdf":
        page = meta.get("page_number")
        if page:
            return f"{source_name}, Page {page}"
        return source_name
    elif source_type == "pptx":
        slide = meta.get("slide_number")
        if slide:
            return f"{source_name}, Slide {slide}"
        return source_name
    elif source_type == "youtube":
        ts = meta.get("timestamp")
        if ts:
            return f"{source_name}, at {ts}"
        return source_name
    elif source_type == "website":
        section = meta.get("section_title")
        if section:
            return f"{source_name}, Section: {section}"
        return source_name
    return source_name


# ---------------------------------------------------------------------------
# Node: Generate answer with streaming
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a knowledgeable learning assistant. Answer the user's question based ONLY on the provided source material.

RULES:
1. Only use information from the provided sources. Do NOT use your general knowledge.
2. If the sources don't contain relevant information, say so clearly.
3. Reference sources using [Source N] notation (e.g., [Source 1], [Source 2]).
4. Be thorough but concise. Use markdown formatting for readability.
5. When listing information from multiple sources, cite each one.
6. For follow-up questions, use conversation history for context but still ground answers in sources.

SOURCES:
{context}"""


def generate_answer(state: LearningState) -> dict:
    """Generate a streaming LLM response grounded in the retrieved context."""
    settings = get_settings()
    context = state.get("context", "No sources available.")
    chat_history = state.get("chat_history", [])
    user_message = state["user_message"]
    stream_callback = state.get("stream_callback")

    # Build messages array
    system_instruction = SYSTEM_PROMPT.format(context=context)

    # Use OpenRouter if API key is configured
    if settings.OPENROUTER_API_KEY:
        messages = [{"role": "system", "content": system_instruction}]
        for msg in chat_history[-10:]:
            role = "user" if msg["role"] == "user" else "assistant"
            messages.append({"role": role, "content": msg["content"]})
        messages.append({"role": "user", "content": user_message})

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://samasocial.ai",
            "X-Title": "SamaSocial AI",
        }
        
        payload = {
            "model": settings.OPENROUTER_CHAT_MODEL,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 2048,
            "stream": True,
        }
        
        full_answer = ""
        
        with httpx.Client(timeout=60.0) as client:
            with client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers) as response:
                if response.status_code != 200:
                    error_text = response.read().decode("utf-8")
                    raise Exception(f"OpenRouter API error (status {response.status_code}): {error_text}")
                
                for line in response.iter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    if line.startswith("data:"):
                        data_str = line[len("data:"):].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choice = data.get("choices", [{}])[0]
                            delta = choice.get("delta", {})
                            token = delta.get("content", "")
                            if token:
                                full_answer += token
                                if stream_callback:
                                    stream_callback(token)
                        except Exception:
                            continue
        return {"answer": full_answer}

    # Otherwise, fallback to direct Google Gemini
    client = _get_genai_client()
    contents = []

    # Add chat history
    for msg in chat_history[-10:]:  # Last 10 messages for context window
        role = "user" if msg["role"] == "user" else "model"
        contents.append(
            genai.types.Content(
                role=role,
                parts=[genai.types.Part(text=msg["content"])],
            )
        )

    # Add current user message
    contents.append(
        genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=user_message)],
        )
    )

    # Stream the response
    full_answer = ""

    response = client.models.generate_content_stream(
        model=settings.GEMINI_CHAT_MODEL,
        contents=contents,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.3,
            max_output_tokens=2048,
        ),
    )

    for chunk in response:
        if chunk.text:
            full_answer += chunk.text
            if stream_callback:
                stream_callback(chunk.text)

    return {"answer": full_answer}



# ---------------------------------------------------------------------------
# Node: Extract and format citations
# ---------------------------------------------------------------------------

def format_citations(state: LearningState) -> dict:
    """Extract [Source N] references from the answer and resolve them to metadata."""
    answer = state.get("answer", "")
    chunks = state.get("retrieved_chunks", [])
    source_map = state.get("source_map", {})

    citations = []
    seen = set()

    import re
    # Find all [Source N] references in the answer
    refs = re.findall(r"\[Source (\d+)\]", answer)

    for ref_num in refs:
        idx = int(ref_num) - 1  # 0-indexed
        if idx < 0 or idx >= len(chunks) or ref_num in seen:
            continue
        seen.add(ref_num)

        chunk = chunks[idx]
        source_id = chunk.get("source_id", "")
        source_info = source_map.get(source_id, {})
        meta = chunk.get("metadata", {})

        label = _build_citation_label(
            source_info.get("source_type", "unknown"),
            source_info.get("name", "Unknown"),
            meta,
        )

        citations.append({
            "source_id": source_id,
            "source_name": source_info.get("name", "Unknown"),
            "source_type": source_info.get("source_type", "unknown"),
            "label": label,
            "chunk_id": chunk.get("id"),
        })

    return {"citations": citations}


# ---------------------------------------------------------------------------
# Node: Save messages to database
# ---------------------------------------------------------------------------

def save_messages(state: LearningState) -> dict:
    """Persist the user message and assistant response to the database."""
    supabase = get_supabase_client()

    # Save user message
    supabase.table("messages").insert({
        "session_id": state["session_id"],
        "role": "user",
        "content": state["user_message"],
    }).execute()

    # Save assistant response with citations
    citations_json = state.get("citations")
    supabase.table("messages").insert({
        "session_id": state["session_id"],
        "role": "assistant",
        "content": state.get("answer", ""),
        "citations": citations_json if citations_json else None,
    }).execute()

    return {}


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------

def build_learning_graph() -> StateGraph:
    """Construct and compile the learning assistant LangGraph."""
    graph = StateGraph(LearningState)

    # Add nodes
    graph.add_node("load_history", load_history)
    graph.add_node("retrieve", retrieve)
    graph.add_node("build_context", build_context)
    graph.add_node("generate_answer", generate_answer)
    graph.add_node("format_citations", format_citations)
    graph.add_node("save_messages", save_messages)

    # Define edges: linear pipeline
    graph.add_edge(START, "load_history")
    graph.add_edge("load_history", "retrieve")
    graph.add_edge("retrieve", "build_context")
    graph.add_edge("build_context", "generate_answer")
    graph.add_edge("generate_answer", "format_citations")
    graph.add_edge("format_citations", "save_messages")
    graph.add_edge("save_messages", END)

    return graph.compile()


# Module-level compiled graph (reused across requests)
learning_graph = build_learning_graph()
