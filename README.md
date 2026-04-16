# Memoria RAG v2 MCP Server 🧠⚡

Sistema de memoria semántica vectorial persistente para agentes de IA, basado en el **Model Context Protocol (MCP)** de Anthropic.

Este sistema permite que tus agentes tengan "memoria a largo plazo" real, utilizando búsqueda semántica avanzada en lugar de simples palabras clave.

## Características Principales

- **Búsqueda Semántica**: Utiliza Google Gemini Embedding 2 (1536 dimensiones) para encontrar conceptos relacionados.
- **Caché Semántica con Redis**: Ahorro drástico de tokens al cachear resultados de preguntas frecuentes.
- **Persistencia Robusta**: Almacenamiento en PostgreSQL con la extensión `pgvector`.
- **Aislamiento por Proyecto**: Soporta múltiples proyectos independientes en el mismo servidor.
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
