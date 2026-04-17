# Arquitectura del Sistema: Memoria RAG v2 MCP

Este proyecto implementa un sistema de memoria semántica persistente diseñado para agentes de IA, utilizando una arquitectura de microservicios ligera pero potente.

## Diagrama de Flujo

```mermaid
graph TD
    A[Agente de IA / RAG CLI] -->|JSON-RPC| B[MCP Server Node.js]
    
    %% Capa 1
    B -->|Ingestión Efímera| R1[(Memoria Sensorial - Redis)]
    
    %% Capa 3
    B -->|Validación de Colisiones| G[Gemini 1.5 Flash - Truth Validator]
    G -.->|Si hay conflicto: DELETE| C[FastAPI RAG Backend]
    
    %% Capa 2
    B -->|HTTP/REST (Memoria Largo Plazo)| C
    C -->|1. Verificar Caché| F[(Redis Cache Semántico)]
    F -->|Hit: Retornar| B
    F -->|Miss| C
    C -->|2. Identificar Agente| H[Jerarquía: Agente > Proyecto]
    H -->|3. Embeddings| D[Google Gemini Embedding 2]
    C -->|4. Query Vectorial| E[(pgvector / PostgreSQL)]
    E -->|Resultados| C
    C -->|4. Guardar Caché| F
    C -->|Respuesta| B
```

## Arquitectura de 3 Capas

### Capa 1: Memoria Sensorial (Buffer en Redis)
Responsable de capturar la atención inmediata y efímera de los agentes para un *monólogo interno* ultra rápido u operaciones intermitentes tempranas que no ameritan carga a Base de Datos.
- **Herramientas**: `rag_sensory_ingest` / `rag_sensory_context`.
- **Implementación**: Un buffer circular Redis (Límitado a 100 mensajes) situado y consumido desde Node.js para mitigar latencias de red.

### Capa 2: Memoria de Trabajo (FastAPI + pgvector)
El backend central del sistema. Se encarga de transformar y persistir metadatos:
- **Embeddings**: Emplea modelo `gemini-embedding-2-preview`.
- **Almacenamiento Vectorial**: Persistencia a disco vía PostgreSQL con el robusto plug-in `pgvector`.
- **Agent-Aware Isolation**: Datos agrupados jerárquicamente por `project_id` y resorte por `agent_id`.
- **Caché Semántica**: Usa Redis pasivamente en peticiones FastAPI concurrentes.

### Capa 3: Memoria de Consolidación (Node.js + Gemini Flash)
Orquesta e intercepta la memoria previo a la fase de Guardado.
- Utilizando la potencia de computación LLM pura, cada vez que un agente inserta una memoria al MCP y ésta *colisiona semánticamente* (distance < 0.1) con otra pre-existente, el Servidor MCP intercepta el proceso.
- En milisegundos se comunica vía REST nativo con **Gemini 1.5 Flash**, para validar si la nueva memoria actualiza o contradice el comportamiento arquitectónico.
- Si así se avala, la memoria antigua retrograda (es eliminada mediante endpoint DELETE en FastAPI) en función de reescribir con un Contexto de Verdad inmaculado.

## Seguridad y Portabilidad
- **Variables de Entorno**: No hay claves hardcodeadas. Se utiliza `.env` para manejar secretos.
- **Aislamiento**: Cada proyecto tiene su propio espacio de búsqueda, evitando fugas de contexto entre diferentes repositorios o tareas.
