# Memoria RAG v2 MCP Server 🧠⚡

Sistema de memoria semántica vectorial persistente para agentes de IA, basado en el **Model Context Protocol (MCP)** de Anthropic.

Este sistema permite que tus agentes tengan "memoria a largo plazo" real, utilizando búsqueda semántica avanzada en lugar de simples palabras clave.

## Arquitectura de 3 Capas (Novedad v3)
- **Capa 1 (Sensorial)**: Buffer circular Redis para ingestión ultra rápida de monólogos de agente (Zero lag).
- **Capa 2 (Trabajo)**: Persistencia vectorial PostgreSQL `pgvector` con Google Gemini Embedding 2 (1536 dimensiones).
- **Capa 3 (Consolidación)**: Validación transaccional automática de colisiones semánticas mediante **Gemini 1.5 Flash**, que borra y reescribe conocimiento obsoleto.

## Características Principales

- **Caché Semántica con Redis**: Ahorro drástico de tokens al cachear resultados de preguntas frecuentes.
- **Agent-Aware Retrieval**: Prioriza o aísla conocimiento basado en el `agent_id`, ideal para equipos de agentes especializados.
- **Multitenancy Estricto**: Aislamiento total de datos mediante `project_id`.
- **Optimización de Costos**: Diseñado específicamente para reducir el consumo de la cuota de la API de Gemini.

## Estructura del Repositorio

- `/rag-server`: Backend en Python (FastAPI + pgvector).
- `/mcp-server`: Cliente MCP en Node.js para conectar con agentes.
- `/docs`: Documentación detallada (Arquitectura, API, Guía).
- `/skill`: Definiciones de habilidades para agentes.

## Instalación Rápida

1. Clona el repositorio.
2. Crea tu archivo `.env` basado en `.env.example`.
3. Ejecuta `docker-compose up -d`.

Para más detalles, consulta la [Guía de Inicio Rápido](./docs/quickstart.md).

## Licencia
MIT
