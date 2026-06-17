"""LangGraph workflow for the AI Course Planning Assistant (Task 2).

This graph handles:
  Intake conversation -> Requirements Extraction -> Plan Generation -> Plan Refinement

It streams conversational explanations while extracting and saving structured JSON course plans.
"""

from __future__ import annotations
import json
import re
import httpx
from typing import Any, Optional, Literal, TypedDict
from langgraph.graph import StateGraph, START, END

import google.genai as genai
from backend.config import get_settings
from backend.services.supabase import get_supabase_client

# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------

class CourseState(TypedDict, total=False):
    """State passed through the course planning assistant graph."""
    session_id: str
    user_message: str

    # The requirements collected so far
    requirements: dict  # subject, audience, skill_level, duration, session_frequency, learning_goals (list)

    # The active course plan (JSON)
    plan: dict  # Matches CoursePlan schema
    version: int

    # conversational response
    assistant_response: str

    # Chat history
    chat_history: list[dict]

    # Flow routing
    next_action: Literal["gather", "generate", "refine"]

    # Stream callback (set at runtime)
    stream_callback: Any


# ---------------------------------------------------------------------------
# Gemini Client
# ---------------------------------------------------------------------------

_genai_client: genai.Client | None = None

def _get_genai_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        settings = get_settings()
        _genai_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _genai_client


# ---------------------------------------------------------------------------
# Helper: Call LLM (Non-Streaming)
# ---------------------------------------------------------------------------

def _call_llm_non_stream(system_prompt: str, user_prompt: str) -> str:
    """Make a standard non-streaming LLM call."""
    settings = get_settings()

    if settings.OPENROUTER_API_KEY:
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://samasocial.ai",
            "X-Title": "SamaSocial AI",
        }
        payload = {
            "model": settings.OPENROUTER_CHAT_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        }
        with httpx.Client(timeout=60.0) as client:
            response = client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"]
            else:
                raise Exception(f"OpenRouter API error: {response.text}")

    # Fallback to direct Gemini
    client = _get_genai_client()
    response = client.models.generate_content(
        model=settings.GEMINI_CHAT_MODEL,
        contents=user_prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2,
        ),
    )
    return response.text or ""


# ---------------------------------------------------------------------------
# Node: Load state from database
# ---------------------------------------------------------------------------

def load_state(state: CourseState) -> dict:
    """Load conversation history, latest requirements, and plan from DB."""
    supabase = get_supabase_client()
    session_id = state["session_id"]

    # 1. Load chat history
    msg_result = (
        supabase.table("messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at")
        .limit(25)
        .execute()
    )
    history = [
        {"role": row["role"], "content": row["content"]}
        for row in (msg_result.data or [])
    ]

    # 2. Load latest course plan and requirements
    plan_result = (
        supabase.table("course_plans")
        .select("*")
        .eq("session_id", session_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )

    plan = {}
    requirements = {
        "subject": None,
        "audience": None,
        "skill_level": None,
        "duration": None,
        "session_frequency": None,
        "learning_goals": [],
    }
    version = 0

    if plan_result.data:
        row = plan_result.data[0]
        plan = row.get("plan") or {}
        requirements = row.get("requirements") or requirements
        version = row.get("version") or 1

    return {
        "chat_history": history,
        "plan": plan,
        "requirements": requirements,
        "version": version,
    }


# ---------------------------------------------------------------------------
# Node: Route message
# ---------------------------------------------------------------------------

def route_message(state: CourseState) -> dict:
    """Determine whether we are gathering requirements, generating, or refining."""
    plan = state.get("plan", {})
    user_msg = state.get("user_message", "").lower().strip()

    # If we already have a course plan generated, any new message is a refinement request
    if plan and plan.get("course_title"):
        return {"next_action": "refine"}

    # If the user explicitly asks to "generate" or "start" the course plan, go to generate
    if any(keyword in user_msg for keyword in ["generate", "build", "create plan", "start plan"]):
        return {"next_action": "generate"}

    return {"next_action": "gather"}


# ---------------------------------------------------------------------------
# Node: Gather requirements
# ---------------------------------------------------------------------------

GATHER_SYSTEM_PROMPT = """You are an intake assistant for a Course Planning tool.
Analyze the user's latest message and conversation history to extract course requirements:
- subject (e.g. Python, Intro to Finance)
- audience (e.g. high schoolers, absolute beginners, professionals)
- skill_level (e.g. Beginner, Intermediate, Advanced)
- duration (e.g. 4 weeks, 1 semester, 10 hours)
- session_frequency (e.g. 2 sessions per week, self-paced)
- learning_goals (list of strings)

Respond ONLY with a valid JSON block of the format:
{
  "subject": string or null,
  "audience": string or null,
  "skill_level": string or null,
  "duration": string or null,
  "session_frequency": string or null,
  "learning_goals": [string] or null,
  "ready_to_generate": true/false
}

Set "ready_to_generate" to true ONLY if we have at least the "subject" AND either "audience" or "skill_level" AND "duration" (or if the user explicitly asks to generate/start with whatever we have). Set to false otherwise.
Do not include any markdown wrappers like ```json. Output raw JSON string only.
"""

def gather_requirements(state: CourseState) -> dict:
    """Extract requirements from the conversation history and update state."""
    user_message = state["user_message"]
    chat_history = state.get("chat_history", [])
    current_reqs = state.get("requirements", {})

    # Format history for requirement extraction context
    history_str = "\n".join([f"{m['role']}: {m['content']}" for m in chat_history[-6:]])
    prompt = f"Existing Requirements:\n{json.dumps(current_reqs)}\n\nConversation History:\n{history_str}\n\nLatest User Message: {user_message}"

    try:
        response_text = _call_llm_non_stream(GATHER_SYSTEM_PROMPT, prompt)
        # Extract json block in case the LLM wrapped it
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            extracted = json.loads(json_match.group(0))
        else:
            extracted = json.loads(response_text)

        # Merge extracted requirements with current requirements
        merged = {**current_reqs}
        for field in ["subject", "audience", "skill_level", "duration", "session_frequency"]:
            if extracted.get(field):
                merged[field] = extracted[field]

        if extracted.get("learning_goals"):
            merged["learning_goals"] = list(set((merged.get("learning_goals") or []) + extracted["learning_goals"]))

        ready = extracted.get("ready_to_generate", False)

        # If user message explicitly demands generation, force ready
        user_msg_lower = user_message.lower()
        if any(w in user_msg_lower for w in ["generate", "build", "create", "start planning"]):
            ready = True

        action = "generate" if ready else "gather"

        return {
            "requirements": merged,
            "next_action": action,
        }
    except Exception as e:
        print(f"[Error in gather_requirements]: {e}")
        # Default fallback: remain in gather
        return {
            "next_action": "gather"
        }


# ---------------------------------------------------------------------------
# Node: Ask Clarifying Questions / Normal Chat
# ---------------------------------------------------------------------------

CHAT_SYSTEM_PROMPT = """You are a professional course planner assistant.
Your goal is to gather intake requirements for designing a structured course plan.
Requirements to gather:
- Subject
- Target Audience
- Skill level (Beginner/Intermediate/Advanced)
- Total course duration
- Session frequency (e.g. self-paced, twice a week)
- Learning goals

Current requirements collected so far:
{requirements}

Instructions:
1. Review what is missing and ask a friendly, brief question to collect one or two missing details.
2. Do NOT ask for everything at once. Keep the interaction conversational and clean.
3. If the subject is not known yet, start by asking what subject or topic they want to plan a course for.
4. Let the user know that once they have provided the basic details, they can say "generate" to build the course plan.
"""

def ask_clarifying_question(state: CourseState) -> dict:
    """Stream a friendly question to collect missing requirements."""
    settings = get_settings()
    current_reqs = state.get("requirements", {})
    chat_history = state.get("chat_history", [])
    user_message = state["user_message"]
    stream_callback = state.get("stream_callback")

    system_instruction = CHAT_SYSTEM_PROMPT.format(requirements=json.dumps(current_reqs, indent=2))

    full_response = ""

    # OpenRouter
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
            "temperature": 0.5,
            "stream": True,
        }
        with httpx.Client(timeout=60.0) as client:
            with client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers) as r:
                if r.status_code != 200:
                    raise Exception(f"OpenRouter error: {r.read().decode('utf-8')}")
                for line in r.iter_lines():
                    line = line.strip()
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            token = data["choices"][0]["delta"].get("content", "")
                            if token:
                                full_response += token
                                if stream_callback:
                                    stream_callback(token)
                        except Exception:
                            continue
        return {"assistant_response": full_response}

    # Gemini Fallback
    client = _get_genai_client()
    contents = []
    for msg in chat_history[-10:]:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(
            genai.types.Content(
                role=role,
                parts=[genai.types.Part(text=msg["content"])],
            )
        )
    contents.append(
        genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=user_message)],
        )
    )

    response = client.models.generate_content_stream(
        model=settings.GEMINI_CHAT_MODEL,
        contents=contents,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.5,
        ),
    )

    for chunk in response:
        if chunk.text:
            full_response += chunk.text
            if stream_callback:
                stream_callback(chunk.text)

    return {"assistant_response": full_response}


# ---------------------------------------------------------------------------
# Node: Generate Plan
# ---------------------------------------------------------------------------

GENERATE_SYSTEM_PROMPT = """You are an expert curriculum designer and education strategist.
Generate a structured, professional, and comprehensive course plan based on the following requirements:
{requirements}

Your response must strictly follow this exact layout (with the separator '--- JSON:'):
<Write a helpful conversational message to the user summarizing the plan, explaining the pedagogical decisions behind the modules, and asking how they would like to refine it. This part will be streamed to the user.>
--- JSON:
{{
  "course_title": "string",
  "description": "string",
  "total_duration": "string",
  "target_audience": "string",
  "skill_level": "string",
  "modules": [
    {{
      "title": "string",
      "description": "string",
      "lessons": [
        {{
          "title": "string",
          "objectives": ["string"],
          "resources": ["string"],
          "duration": "string"
        }}
      ],
      "assignments": ["string"],
      "assessments": [
        {{
          "title": "string",
          "type": "quiz | project | exam",
          "description": "string"
        }}
      ]
    }}
  ]
}}

Double check that the JSON block is perfectly formatted and contains NO markdown wrappers like ```json or trailing text.
"""

def generate_plan(state: CourseState) -> dict:
    """Generate the initial course plan from collected requirements."""
    settings = get_settings()
    current_reqs = state.get("requirements", {})
    chat_history = state.get("chat_history", [])
    user_message = state["user_message"]
    stream_callback = state.get("stream_callback")

    system_instruction = GENERATE_SYSTEM_PROMPT.format(requirements=json.dumps(current_reqs, indent=2))
    full_output = ""

    # OpenRouter
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
            "temperature": 0.4,
            "stream": True,
        }
        with httpx.Client(timeout=60.0) as client:
            with client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers) as r:
                if r.status_code != 200:
                    raise Exception(f"OpenRouter error: {r.read().decode('utf-8')}")
                for line in r.iter_lines():
                    line = line.strip()
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            token = data["choices"][0]["delta"].get("content", "")
                            if token:
                                full_output += token
                                if stream_callback:
                                    stream_callback(token)
                        except Exception:
                            continue

    else:
        # Gemini Fallback
        client = _get_genai_client()
        contents = []
        for msg in chat_history[-10:]:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(
                genai.types.Content(
                    role=role,
                    parts=[genai.types.Part(text=msg["content"])],
                )
            )
        contents.append(
            genai.types.Content(
                role="user",
                parts=[genai.types.Part(text=user_message)],
            )
        )

        response = client.models.generate_content_stream(
            model=settings.GEMINI_CHAT_MODEL,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.4,
            ),
        )

        for chunk in response:
            if chunk.text:
                full_output += chunk.text
                if stream_callback:
                    stream_callback(chunk.text)

    # Parse full output to separate explanation text from plan JSON
    explanation = full_output
    plan_json = {}

    if "--- JSON:" in full_output:
        parts = full_output.split("--- JSON:")
        explanation = parts[0].strip()
        json_part = parts[1].strip()
        try:
            plan_json = json.loads(json_part)
        except Exception:
            # Try matching JSON pattern
            match = re.search(r"\{.*\}", json_part, re.DOTALL)
            if match:
                try:
                    plan_json = json.loads(match.group(0))
                except Exception:
                    pass

    return {
        "assistant_response": explanation,
        "plan": plan_json,
        "version": state.get("version", 0) + 1,
    }


# ---------------------------------------------------------------------------
# Node: Refine Plan
# ---------------------------------------------------------------------------

REFINE_SYSTEM_PROMPT = """You are an expert curriculum designer and strategist.
Update the current active course plan based on the user's refinement request.

Current course plan:
{current_plan}

Refinement request: {refinement_request}

Your response must strictly follow this exact layout (with the separator '--- JSON:'):
<Write a conversational message explaining exactly what updates were made, why these decisions were taken, and check if they want to make any further adjustments. This part will be streamed to the user.>
--- JSON:
{{
  "course_title": "string",
  "description": "string",
  "total_duration": "string",
  "target_audience": "string",
  "skill_level": "string",
  "modules": [
    {{
      "title": "string",
      "description": "string",
      "lessons": [
        {{
          "title": "string",
          "objectives": ["string"],
          "resources": ["string"],
          "duration": "string"
        }}
      ],
      "assignments": ["string"],
      "assessments": [
        {{
          "title": "string",
          "type": "quiz | project | exam",
          "description": "string"
        }}
      ]
    }}
  ]
}}

Double check that the JSON block is perfectly formatted and contains NO markdown wrappers like ```json or trailing text.
"""

def refine_plan(state: CourseState) -> dict:
    """Modify the active course plan using conversational feedback."""
    settings = get_settings()
    current_plan = state.get("plan", {})
    chat_history = state.get("chat_history", [])
    user_message = state["user_message"]
    stream_callback = state.get("stream_callback")

    system_instruction = REFINE_SYSTEM_PROMPT.format(
        current_plan=json.dumps(current_plan, indent=2),
        refinement_request=user_message,
    )
    full_output = ""

    # OpenRouter
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
            "temperature": 0.4,
            "stream": True,
        }
        with httpx.Client(timeout=60.0) as client:
            with client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers) as r:
                if r.status_code != 200:
                    raise Exception(f"OpenRouter error: {r.read().decode('utf-8')}")
                for line in r.iter_lines():
                    line = line.strip()
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            token = data["choices"][0]["delta"].get("content", "")
                            if token:
                                full_output += token
                                if stream_callback:
                                    stream_callback(token)
                        except Exception:
                            continue

    else:
        # Gemini Fallback
        client = _get_genai_client()
        contents = []
        for msg in chat_history[-10:]:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(
                genai.types.Content(
                    role=role,
                    parts=[genai.types.Part(text=msg["content"])],
                )
            )
        contents.append(
            genai.types.Content(
                role="user",
                parts=[genai.types.Part(text=user_message)],
            )
        )

        response = client.models.generate_content_stream(
            model=settings.GEMINI_CHAT_MODEL,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.4,
            ),
        )

        for chunk in response:
            if chunk.text:
                full_output += chunk.text
                if stream_callback:
                    stream_callback(chunk.text)

    # Parse full output to separate explanation text from plan JSON
    explanation = full_output
    plan_json = current_plan

    if "--- JSON:" in full_output:
        parts = full_output.split("--- JSON:")
        explanation = parts[0].strip()
        json_part = parts[1].strip()
        try:
            plan_json = json.loads(json_part)
        except Exception:
            match = re.search(r"\{.*\}", json_part, re.DOTALL)
            if match:
                try:
                    plan_json = json.loads(match.group(0))
                except Exception:
                    pass

    return {
        "assistant_response": explanation,
        "plan": plan_json,
        "version": state.get("version", 0) + 1,
    }


# ---------------------------------------------------------------------------
# Node: Save State to Database
# ---------------------------------------------------------------------------

def save_state(state: CourseState) -> dict:
    """Save user/assistant messages and any newly generated plan version to DB."""
    supabase = get_supabase_client()
    session_id = state["session_id"]
    user_msg = state["user_message"]
    response = state.get("assistant_response", "")
    plan = state.get("plan", {})
    requirements = state.get("requirements", {})
    version = state.get("version", 0)

    # 1. Save user message
    supabase.table("messages").insert({
        "session_id": session_id,
        "role": "user",
        "content": user_msg,
    }).execute()

    # 2. Save assistant message
    supabase.table("messages").insert({
        "session_id": session_id,
        "role": "assistant",
        "content": response,
    }).execute()

    # 3. Save active course plan (only if a plan title/description exists)
    if plan and plan.get("course_title"):
        supabase.table("course_plans").insert({
            "session_id": session_id,
            "version": version,
            "plan": plan,
            "requirements": requirements,
        }).execute()

    return {}


# ---------------------------------------------------------------------------
# Routing logic (for Conditional Edges)
# ---------------------------------------------------------------------------

def router_edge(state: CourseState) -> Literal["ask_clarifying_question", "generate_plan", "refine_plan"]:
    """Determine which generator node to execute."""
    action = state.get("next_action")
    if action == "generate":
        return "generate_plan"
    elif action == "refine":
        return "refine_plan"
    return "ask_clarifying_question"


# ---------------------------------------------------------------------------
# Build the Graph
# ---------------------------------------------------------------------------

def build_course_graph() -> StateGraph:
    """Compile the Course Planning assistant LangGraph."""
    graph = StateGraph(CourseState)

    # Add nodes
    graph.add_node("load_state", load_state)
    graph.add_node("route_message", route_message)
    graph.add_node("gather_requirements", gather_requirements)
    graph.add_node("ask_clarifying_question", ask_clarifying_question)
    graph.add_node("generate_plan", generate_plan)
    graph.add_node("refine_plan", refine_plan)
    graph.add_node("save_state", save_state)

    # Define flows
    graph.add_edge(START, "load_state")
    graph.add_edge("load_state", "route_message")

    # Conditional router
    graph.add_conditional_edges(
        "route_message",
        router_edge,
        {
            "ask_clarifying_question": "ask_clarifying_question",
            "generate_plan": "generate_plan",
            "refine_plan": "refine_plan",
        }
    )

    # Allow gather_requirements to flow into router again or generate
    graph.add_edge("route_message", "gather_requirements")
    graph.add_conditional_edges(
        "gather_requirements",
        router_edge,
        {
            "ask_clarifying_question": "ask_clarifying_question",
            "generate_plan": "generate_plan",
            "refine_plan": "refine_plan",
        }
    )

    # Core branches save state before finishing
    graph.add_edge("ask_clarifying_question", "save_state")
    graph.add_edge("generate_plan", "save_state")
    graph.add_edge("refine_plan", "save_state")
    graph.add_edge("save_state", END)

    return graph.compile()

course_graph = build_course_graph()
