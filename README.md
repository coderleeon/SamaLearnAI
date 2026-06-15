# SamaSocial AI Assistant

Multi-Source Learning Assistant & AI Course Planning — powered by **Gemini 2.5 Flash**, **LangGraph**, **Next.js 15**, and **Supabase**.

## Architecture

```
Frontend (Next.js 15, port 3000) → proxy → Backend (FastAPI, port 8000) → Supabase (pgvector)
```

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **Supabase** account with a project
- **Google AI** API key (for Gemini)

## Quick Start

### 1. Clone & Install

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your Supabase URL, service key, and Gemini API key

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 3. Set Up Database

1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click "Run"

### 4. Run Locally

```bash
# Terminal 1 — Backend
cd backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 5. Verify Setup

```bash
# Health check (should return {"status": "healthy"})
curl http://localhost:8000/api/v1/health

# Through the proxy (same response)
curl http://localhost:3000/api/v1/health
```

## Project Structure

```
NAVgurukul/
├── frontend/          # Next.js 15 (App Router + Tailwind)
│   ├── app/           # Pages and layouts
│   ├── components/    # Reusable UI components
│   ├── hooks/         # Custom React hooks
│   └── lib/           # API client and utilities
├── backend/           # FastAPI
│   ├── api/           # Route handlers
│   ├── agents/        # LangGraph workflows
│   ├── parsers/       # PDF, PPTX, YouTube, Web parsers
│   ├── rag/           # Chunking, embedding, retrieval
│   └── services/      # Supabase client, Pydantic models
└── supabase/
    └── migrations/    # SQL schema files
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, Tailwind CSS, TypeScript |
| Backend | FastAPI, LangGraph, LangChain |
| LLM | Gemini 2.5 Flash |
| Embeddings | gemini-embedding-001 (3072d) |
| Database | Supabase (PostgreSQL + pgvector) |
| Streaming | SSE (Server-Sent Events) |
