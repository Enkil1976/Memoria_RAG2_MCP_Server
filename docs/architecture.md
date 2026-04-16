# Arquitectura del Sistema: Memoria RAG v2 MCP

Este proyecto implementa un sistema de memoria semántica persistente diseñado para agentes de IA, utilizando una arquitectura de microservicios ligera pero potente.

## Diagrama de Flujo

```mermaid
graph TD
    A[Agente de IA / Antigravity] -->|JSON-RPC| B[MCP Server Node.js]
    B -->|HTTP/REST| C[FastAPI RAG Backend]
    C -->|1. Verificar Caché| F[(Redis Cache)]
    F -->|Hit: Retornar| B
    F -->|Miss| C
    C -->|2. Identificar Agente| G[Jerarquía: Agente > Proyecto]
    G -->|3. Embeddings| D[Google Gemini API]
    C -->|4. Query Vectorial| E[PostgreSQL + pgvector]
    E -->|Resultados| C
    C -->|4. Guardar Caché| F
    C -->|Respuesta| B
    B -->|Respuesta| A
```

## Componentes

### 1. RAG Core (FastAPI + Python)
El cerebro del sistema. Se encarga de:
- **Chunking**: Fragmentación inteligente de textos largos.
- **Embeddings**: Generación de vectores usando el modelo `gemini-embedding-2-preview`.
- **Almacenamiento Vectorial**: Persistencia en PostgreSQL utilizando `pgvector`.
- **Caché Semántica**: Integración con Redis para optimización de tokens.
- **Agent-Aware Isolation**: Los datos están etiquetados por `agent_id`, permitiendo búsquedas confinadas al conocimiento de un agente específico o búsquedas globales priorizadas.
- **Multitenancy**: Aislamiento total de datos mediante `project_id`.

### 2. MCP Server (Node.js)
El puente de comunicación. Implementa el **Model Context Protocol**:
- Se comunica con los agentes vía `stdio` (entrada/salida estándar).
- Traduce las llamadas a herramientas (tools) en peticiones HTTP al Backend de FastAPI.
- Maneja la configuración específica del proyecto sin exponer claves de API al cliente final.

### 3. Base de Datos (PostgreSQL + pgvector)
Almacena tanto la memoria en texto plano como sus representaciones vectoriales.
- Tabla `memories_v2`: Metadatos y contenido original.
- Tabla `memory_chunks_v2`: Fragmentos de texto con su correspondiente vector de embedding.

## Seguridad y Portabilidad
- **Variables de Entorno**: No hay claves hardcodeadas. Se utiliza `.env` para manejar secretos.
- **Aislamiento**: Cada proyecto tiene su propio espacio de búsqueda, evitando fugas de contexto entre diferentes repositorios o tareas.
