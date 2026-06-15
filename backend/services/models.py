"""Shared Pydantic models used across the backend.

These models define the data contracts for API requests/responses
and the structured output schemas for LLM-generated content.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------

class SessionCreate(BaseModel):
    task_type: str = Field(..., pattern=r"^(learning|course)$")
    title: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    task_type: str
    title: Optional[str]
    created_at: datetime


# ---------------------------------------------------------------------------
# Sources (Task 1)
# ---------------------------------------------------------------------------

class SourceUploadResponse(BaseModel):
    id: str
    session_id: str
    source_type: str
    name: str
    status: str
    metadata: Optional[dict] = None


class SourceStatusResponse(BaseModel):
    id: str
    status: str
    name: str
    source_type: str
    summary: Optional[str] = None
    metadata: Optional[dict] = None


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    session_id: str
    message: str


class Citation(BaseModel):
    source_id: str
    source_name: str
    source_type: str
    label: str  # e.g., "PDF Page 12", "Video 03:22", "Slide 4"
    chunk_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    citations: Optional[list[Citation]] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Course Plan (Task 2)
# ---------------------------------------------------------------------------

class CourseRequirements(BaseModel):
    """Intake requirements gathered from the mentor."""
    subject: Optional[str] = None
    audience: Optional[str] = None
    skill_level: Optional[str] = None
    duration: Optional[str] = None
    session_frequency: Optional[str] = None
    learning_goals: Optional[list[str]] = None


class Assessment(BaseModel):
    title: str
    type: str  # quiz, project, exam
    description: str


class Lesson(BaseModel):
    title: str
    objectives: list[str]
    resources: list[str]
    duration: str


class Module(BaseModel):
    title: str
    description: str
    lessons: list[Lesson]
    assignments: list[str]
    assessments: list[Assessment]


class CoursePlan(BaseModel):
    """Full structured course plan — the primary output of Task 2."""
    course_title: str
    description: str
    total_duration: str
    target_audience: str
    skill_level: str
    modules: list[Module]


class CoursePlanResponse(BaseModel):
    id: str
    session_id: str
    version: int
    plan: CoursePlan
    requirements: Optional[CourseRequirements] = None
    created_at: datetime
