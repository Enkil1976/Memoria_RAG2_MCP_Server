# Resumen del Sistema RAG v2 MCP Server

## Descripción General

El sistema RAG v2 MCP Server es una solución de memoria semántica vectorial persistente para agentes de IA basada en el Model Context Protocol (MCP) de Anthropic. Permite que los agentes tengan "memoria a largo plazo" mediante búsqueda semántica avanzada en lugar de búsquedas por palabras clave.

## Arquitectura de 3 Capas

1. **Capa 1 (Sensorial)**: Buffer circular Redis para ingestión ultra rápida de monólogos de agente (Zero lag).
2. **Capa 2 (Trabajo)**: Persistencia vectorial PostgreSQL con `pgvector` y Google Gemini Embedding 2 (1536 dimensiones).
3. **Capa 3 (Consolidación)**: Validación transaccional automática de colisiones semánticas mediante Gemini 1.5 Flash.

## Componentes Principales

- **`/rag-server`**: Backend en Python (FastAPI + pgvector) que maneja la persistencia y búsqueda vectorial.
- **`/mcp-server`**: Cliente MCP en Node.js para conectar con agentes de IA.
- **`/docs`**: Documentación detallada del sistema.
- **`/skill`**: Definiciones de habilidades para agentes.

## Características Clave

- **Caché Semántica con Redis**: Ahorro drástico de tokens al cachear resultados de preguntas frecuentes.
- **Agent-Aware Retrieval**: Prioriza o aísla conocimiento basado en el `agent_id`.
- **Multitenancy Estricto**: Aislamiento total de datos mediante `project_id`.
- **Optimización de Costos**: Reduce el consumo de la cuota de la API de Gemini.

## Instalación

1. Clonar el repositorio.
2. Crear el archivo `.env` basado en `.env.example`.
3. Ejecutar `docker-compose up -d`.

## Uso

Una vez instalado, se puede interactuar con el sistema a través de:
- `rag_health()`: Para confirmar la conexión.
- `rag_memory_write(...)`: Para guardar una decisión de diseño o conocimiento importante.
- `rag_memory_search(...)`: Para buscar información previamente almacenada.

Este sistema permite una memoria persistente y semántica para agentes de IA, facilitando la creación de contextos ricos y relevantes para la toma de decisiones de los agentes.