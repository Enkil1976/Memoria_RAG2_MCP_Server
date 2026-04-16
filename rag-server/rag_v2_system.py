"""
BioDome RAG v2 — Core System
Memoria Semántica Vectorial con Gemini Embedding 2 + PostgreSQL + pgvector

Todas las credenciales se leen desde variables de entorno o .env
"""

import os
import json
import hashlib
import psycopg2
import redis
from datetime import datetime
from dotenv import load_dotenv
from google import genai

# ── Cargar variables de entorno ───────────────────────────────────────────────
load_dotenv()

DB_CONFIG = {
    'dbname':   os.environ.get('POSTGRES_DB',       'postgres'),
    'user':     os.environ.get('POSTGRES_USER',     'postgres'),
    'password': os.environ.get('POSTGRES_PASSWORD', ''),
    'host':     os.environ.get('POSTGRES_HOST',     'localhost'),
    'port':     os.environ.get('POSTGRES_PORT',     '5432'),
}

GEMINI_API_KEY  = os.environ.get('GEMINI_API_KEY', '')
MODEL_ID        = os.environ.get('GEMINI_MODEL',   'gemini-embedding-2-preview')
EMBEDDING_DIM   = int(os.environ.get('EMBEDDING_DIM', '1536'))
CHUNK_SIZE      = int(os.environ.get('CHUNK_SIZE', '500'))
CHUNK_OVERLAP   = int(os.environ.get('CHUNK_OVERLAP', '100'))

# ── Configuración Redis ───────────────────────────────────────────────────────
REDIS_CONFIG = {
    'host':     os.environ.get('REDIS_HOST',     'localhost'),
    'port':     int(os.environ.get('REDIS_PORT', '6379')),
    'password': os.environ.get('REDIS_PASSWORD', None),
    'decode_responses': True
}
REDIS_TTL = int(os.environ.get('REDIS_TTL', '3600'))

# ── Validación de arranque ────────────────────────────────────────────────────
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY no está definida. Copia .env.example → .env y completa los valores.")

if not DB_CONFIG['password']:
    raise EnvironmentError("POSTGRES_PASSWORD no está definida.")


class RAGSystemV2:
    def __init__(self):
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.conn   = psycopg2.connect(**DB_CONFIG)
        self.conn.autocommit = False
        self.redis  = self._init_redis()
        self._init_db()

    def _init_redis(self):
        try:
            r = redis.Redis(**REDIS_CONFIG)
            if r.ping():
                print(f"[RAG v2] Redis conectado en {REDIS_CONFIG['host']}:{REDIS_CONFIG['port']}")
                return r
        except Exception as e:
            print(f"[RAG v2] ⚠️  Redis no disponible (caché deshabilitada): {e}")
        return None

    def _get_cache_key(self, project_id: str, query: str):
        query_hash = hashlib.md5(query.strip().lower().encode()).hexdigest()
        return f"rag_cache:{project_id}:{query_hash}"

    # ── Inicialización del esquema ────────────────────────────────────────────
    def _init_db(self):
        with self.conn.cursor() as cur:
            try:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector")

                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS memories_v2 (
                        id         SERIAL PRIMARY KEY,
                        project_id TEXT NOT NULL DEFAULT 'default',
                        title      TEXT NOT NULL,
                        content    TEXT NOT NULL,
                        tags       TEXT[],
                        memory_type TEXT,
                        metadata   JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS memory_chunks_v2 (
                        id         SERIAL PRIMARY KEY,
                        memory_id  INTEGER REFERENCES memories_v2(id) ON DELETE CASCADE,
                        project_id TEXT NOT NULL DEFAULT 'default',
                        chunk_text TEXT NOT NULL,
                        embedding  vector({EMBEDDING_DIM}),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                # Índices
                cur.execute("CREATE INDEX IF NOT EXISTS memories_v2_tags_idx    ON memories_v2 USING GIN (tags)")
                cur.execute("CREATE INDEX IF NOT EXISTS memories_v2_project_idx ON memories_v2 (project_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS chunks_v2_project_idx   ON memory_chunks_v2 (project_id)")

                # Migración retrocompatible: añadir columnas si faltaran
                cur.execute("ALTER TABLE memories_v2      ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT 'default'")
                cur.execute("ALTER TABLE memory_chunks_v2 ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT 'default'")

                self.conn.commit()
                print(f"[RAG v2] DB inicializada — dim={EMBEDDING_DIM}, modelo={MODEL_ID}")
            except Exception as e:
                self.conn.rollback()
                raise RuntimeError(f"[_init_db] Error: {e}") from e

    # ── Generación de embeddings ──────────────────────────────────────────────
    def generate_embedding(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT", title: str = None):
        config = {
            'task_type':            task_type,
            'output_dimensionality': EMBEDDING_DIM,
        }
        if title:
            config['title'] = title

        result = self.client.models.embed_content(
            model=MODEL_ID,
            contents=text,
            config=config
        )
        return result.embeddings[0].values

    # ── Escritura de memoria ──────────────────────────────────────────────────
    def add_memory(self, title: str, content: str, tags=None,
                   memory_type: str = "note", metadata=None, project_id: str = "default") -> int:
        with self.conn.cursor() as cur:
            try:
                cur.execute("""
                    INSERT INTO memories_v2 (project_id, title, content, tags, memory_type, metadata)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (project_id, title, content, tags or [], memory_type, json.dumps(metadata or {})))

                memory_id = cur.fetchone()[0]

                for chunk in self._chunk_text(content):
                    embedding = self.generate_embedding(chunk, task_type="RETRIEVAL_DOCUMENT", title=title)
                    cur.execute("""
                        INSERT INTO memory_chunks_v2 (memory_id, project_id, chunk_text, embedding)
                        VALUES (%s, %s, %s, %s)
                    """, (memory_id, project_id, chunk, embedding))

                self.conn.commit()
                return memory_id
            except Exception as e:
                self.conn.rollback()
                raise RuntimeError(f"[add_memory] Error: {e}") from e

    # ── Búsqueda semántica ────────────────────────────────────────────────────
    def search_semantic(self, query: str, limit: int = 5,
                        task_type: str = "RETRIEVAL_QUERY", project_id: str = "default"):
        
        # 1. Intentar recuperar desde caché
        cache_key = self._get_cache_key(project_id, query)
        if self.redis:
            try:
                cached_data = self.redis.get(cache_key)
                if cached_data:
                    print(f"[RAG v2] ⚡ Hit en caché para: {query[:30]}...")
                    return json.loads(cached_data)
            except Exception as e:
                print(f"[RAG v2] Error leyendo caché: {e}")

        # 2. Si no hay caché, generar embedding y buscar
        query_embedding = self.generate_embedding(query, task_type=task_type)

        with self.conn.cursor() as cur:
            try:
                cur.execute("""
                    SELECT m.id, m.title, mc.chunk_text,
                           1 - (mc.embedding <=> %s::vector) AS similarity
                    FROM memory_chunks_v2 mc
                    JOIN memories_v2 m ON mc.memory_id = m.id
                    WHERE mc.project_id = %s
                    ORDER BY mc.embedding <=> %s::vector
                    LIMIT %s
                """, (query_embedding, project_id, query_embedding, limit))

                results = [
                    {
                        'id':         row[0],
                        'title':      row[1],
                        'content':    row[2],
                        'similarity': round(row[3], 4)
                    }
                    for row in cur.fetchall()
                ]
                self.conn.commit()

                # 3. Guardar en caché para futuras consultas
                if self.redis and results:
                    try:
                        self.redis.setex(cache_key, REDIS_TTL, json.dumps(results))
                    except Exception as e:
                        print(f"[RAG v2] Error escribiendo caché: {e}")

                return results
            except Exception as e:
                self.conn.rollback()
                raise RuntimeError(f"[search_semantic] Error: {e}") from e

    # ── Listado de proyectos ──────────────────────────────────────────────────
    def list_projects(self):
        with self.conn.cursor() as cur:
            try:
                cur.execute("""
                    SELECT project_id, COUNT(*) AS mem_count
                    FROM memories_v2
                    GROUP BY project_id
                    ORDER BY mem_count DESC
                """)
                return [{'project_id': r[0], 'memory_count': r[1]} for r in cur.fetchall()]
            except Exception as e:
                self.conn.rollback()
                raise RuntimeError(f"[list_projects] Error: {e}") from e

    # ── Chunking ──────────────────────────────────────────────────────────────
    def _chunk_text(self, text: str):
        words = text.split()
        chunks = [
            " ".join(words[i:i + CHUNK_SIZE])
            for i in range(0, len(words), CHUNK_SIZE - CHUNK_OVERLAP)
        ]
        return chunks or [text]

    def close(self):
        self.conn.close()


if __name__ == "__main__":
    rag = RAGSystemV2()
    print(f"✅ RAG v2 System OK — modelo={MODEL_ID}, dim={EMBEDDING_DIM}")
    rag.close()
