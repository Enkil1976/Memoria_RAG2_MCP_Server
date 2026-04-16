"""
BioDome RAG v2 — FastAPI REST API
Expone endpoints de memoria semántica sobre el sistema RAG v2
"""

import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
from rag_v2_system import RAGSystemV2
import uvicorn

load_dotenv()

API_HOST    = os.environ.get('API_HOST', '0.0.0.0')
API_PORT    = int(os.environ.get('API_PORT', '5001'))
API_VERSION = "2.1.0"

# ── Modelos Pydantic ──────────────────────────────────────────────────────────
class Memory(BaseModel):
    title:       str
    content:     str
    tags:        Optional[List[str]]       = []
    memory_type: Optional[str]             = "note"
    metadata:    Optional[Dict[str, Any]]  = {}
    project_id:  Optional[str]             = "default"

class SearchQuery(BaseModel):
    query:      str
    limit:      Optional[int] = 5
    task_type:  Optional[str] = "RETRIEVAL_QUERY"
    project_id: Optional[str] = "default"

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "RAG v2 MCP Server",
    description = "Memoria semántica vectorial con Gemini Embedding 2 + pgvector",
    version     = API_VERSION
)

rag = RAGSystemV2()

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status":   "healthy",
        "model":    os.environ.get('GEMINI_MODEL', 'gemini-embedding-2-preview'),
        "version":  API_VERSION,
        "features": ["multi-project", "semantic-search", f"{os.environ.get('EMBEDDING_DIM', '1536')}-dim"]
    }

@app.post("/api/memories")
async def add_memory(memory: Memory):
    try:
        memory_id = rag.add_memory(
            title       = memory.title,
            content     = memory.content,
            tags        = memory.tags,
            memory_type = memory.memory_type,
            metadata    = memory.metadata,
            project_id  = memory.project_id
        )
        return {"id": memory_id, "status": "success", "project_id": memory.project_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search")
async def search_memories(search: SearchQuery):
    try:
        results = rag.search_semantic(
            query      = search.query,
            limit      = search.limit,
            task_type  = search.task_type,
            project_id = search.project_id
        )
        return {"results": results, "query": search.query, "project_id": search.project_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects")
async def list_projects():
    try:
        return {"projects": rag.list_projects()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(app, host=API_HOST, port=API_PORT)
