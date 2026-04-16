---
name: rag-v2-mcp
description: Servidor MCP dedicado para el sistema RAG v2 de BioDome. Proporciona memoria semántica vectorial usando Gemini Embedding 2 (1536 dim) sobre PostgreSQL + pgvector en Azure. Usar cuando se necesite persistir o recuperar conocimiento con búsqueda semántica de alta precisión.
---

# rag-v2-mcp Skill

Esta habilidad permite a los agentes de IA interactuar con el sistema de memoria semántica vectorial **RAG v2**.

## Herramientas

- `rag_health`: Verifica la conexión con el motor RAG.
- `rag_memory_write`: Persiste información importante con búsqueda semántica.
- `rag_memory_search`: Recupera contexto basado en el significado (no solo palabras clave).
- `rag_project_list`: Gestiona y visualiza proyectos con memoria.
- `rag_project_init`: Crea espacios de memoria aislados para nuevos desarrollos.

## Cuándo usar
- Para recordar decisiones de diseño a través de múltiples sesiones.
- Para buscar soluciones a bugs documentados previamente.
- Para mantener la coherencia arquitectónica entre diferentes agentes del pipeline.

## Configuración
Asegúrate de que el servidor RAG esté corriendo y la URL configurada en el servidor MCP.
