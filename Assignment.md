# **SamaSocial AI Assignment \- Build Plan**

## **Goal**

Build both tasks with production-quality architecture while keeping implementation simple enough to complete within 3 days.

Tech Stack:

* Next.js 15  
* FastAPI  
* LangGraph  
* Supabase  
* Gemini 2.5 Flash (or GPT-4.1 Mini)

---

# **Task 1: Multi-Source AI Learning Assistant**

## **Features**

User can provide:

* PDF  
* PPTX  
* YouTube URL  
* Website URL

Multiple sources can be used together in the same session.

Example:

PDF \+ YouTube \+ Website

The assistant answers only from uploaded content.

---

## **Requirements**

### **Source Processing**

PDF:

* Extract text  
* Chunk content  
* Store embeddings

PPTX:

* Extract slide text  
* Preserve slide number metadata

Website:

* Scrape content  
* Clean HTML  
* Chunk content

YouTube:

* Fetch transcript  
* Chunk transcript  
* Preserve timestamps

---

### **Retrieval**

Use RAG.

Workflow:

User Question  
→ Retrieve Relevant Chunks  
→ Build Context  
→ Generate Answer

Do NOT place full documents into prompts.

---

### **Citations**

Every answer should reference source.

Examples:

* From Slide 4  
* From PDF Page 12  
* From Website Section X  
* At 03:22 in Video

---

### **Memory**

Conversation history should persist during session.

Follow-up questions must work.

Example:

User: Explain reinforcement learning.

User: Explain it simply.

Assistant understands "it".

---

### **Streaming**

Responses should stream token-by-token.

---

### **Bonus**

* Source summaries  
* Quiz Generation  
* Source badges  
* Multi-source attribution

---

# **Task 2: AI Course Planning Assistant**

## **Goal**

Mentors can generate structured course plans through conversation.

---

## **Intake Questions**

Collect:

* Subject  
* Audience  
* Skill level  
* Duration  
* Session frequency  
* Learning goals

---

## **Output**

Generate structured course plan.

Required sections:

* Modules  
* Lessons  
* Objectives  
* Resources  
* Assignments  
* Assessments

---

## **JSON Output**

Produce structured JSON.

Example:

{  
"course\_title": "",  
"modules": \[\]  
}

Use Pydantic models.

---

## **Refinement**

User can request:

* simplify module  
* add projects  
* change duration  
* add assessments

System updates plan.

---

## **UI**

Split Layout:

Left:

* Chat

Right:

* Live Course Plan Preview

Preview updates after every refinement.

---

## **Bonus**

* Curriculum PDF upload  
* Difficulty progression  
* Prerequisite suggestions

---

# **Suggested Architecture**

Frontend

/app  
/components  
/hooks

Backend

/api  
/services  
/agents  
/rag  
/parsers

---

# **LangGraph Nodes**

Task 1

Input  
→ Source Loader  
→ Retriever  
→ Context Builder  
→ Answer Generator  
→ Citation Formatter

Task 2

Conversation  
→ Requirement Extractor  
→ Course Planner  
→ JSON Generator  
→ Plan Refiner

---

# **Database**

Supabase

Tables:

sessions  
messages  
sources  
chunks  
course\_plans

Use pgvector for embeddings.

---

# **Evaluation Priorities**

1. Accurate retrieval  
2. Grounded answers  
3. Clean architecture  
4. Good UX  
5. Streaming  
6. Source citations

Focus on shipping a polished MVP rather than implementing every possible feature.

