-- ============================================================================
-- SamaSocial AI Assignment — Initial Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Sessions (shared across both tasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL CHECK (task_type IN ('learning', 'course')),
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Chat messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session
    ON messages(session_id, created_at);

-- ---------------------------------------------------------------------------
-- Sources (uploaded files / URLs for Task 1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'pptx', 'youtube', 'website')),
    name TEXT NOT NULL,
    metadata JSONB,
    summary TEXT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sources_session
    ON sources(session_id);

-- ---------------------------------------------------------------------------
-- Chunks (vector store for RAG)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(3072),
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_source
    ON chunks(source_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ---------------------------------------------------------------------------
-- Course Plans (Task 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    version INT DEFAULT 1,
    plan JSONB NOT NULL,
    requirements JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_plans_session
    ON course_plans(session_id, version DESC);

-- ---------------------------------------------------------------------------
-- Vector similarity search function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding vector(3072),
    filter_session_id UUID,
    match_count INT DEFAULT 5,
    match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    source_id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.source_id,
        c.content,
        c.metadata,
        (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE s.session_id = filter_session_id
      AND s.status = 'ready'
      AND (1 - (c.embedding <=> query_embedding)) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Verify setup
-- ---------------------------------------------------------------------------
-- Run this to confirm everything was created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
