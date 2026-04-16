# Guía de Inicio Rápido

Sigue estos pasos para poner en marcha tu propia instancia de Memoria RAG v2 y conectarla con tus agentes de IA.

## Requisitos Previos
- Docker y Docker Compose (recomendado)
- O Python 3.11+ y Node.js 18+
- Una API Key de Google Gemini (generada en [Google AI Studio](https://aistudio.google.com/app/apikey))

## Opción 1: Despliegue con Docker (Recomendado)

1. **Configurar variables**:
   ```bash
   cp rag-server/.env.example .env
   # Edita el archivo .env con tu GEMINI_API_KEY
   ```

2. **Levantar infraestructura**:
   ```bash
   docker-compose up -d
   ```

## Opción 2: Instalación Manual

### 1. Servidor RAG (FastAPI)
```bash
cd rag-server
bash install.sh
# Configura el .env y luego inicia
source env/bin/activate
python rag_v2_api.py
```

### 2. Servidor MCP (Node.js)
```bash
cd mcp-server
npm install
cp .env.example .env
# Si el RAG corre en otro servidor, cambia RAG_URL en .env
```

## Configuración en tu Cliente MCP (ej. Antigravity/Claude Code)

Añade lo siguiente a tu archivo de configuración de MCP (ej. `mcp_config.json`):

```json
"rag-v2-mcp": {
  "command": "node",
  "args": [
    "/ruta/absoluta/a/mcp-server/server.js",
    "TuProyecto",
    "http://localhost:5001"
  ]
}
```

## Primeros Pasos
Una vez instalado, puedes pedirle a tu agente de IA:
1. `rag_health()` - Para confirmar la conexión.
2. `rag_memory_write(...)` - Para guardar tu primera decisión de diseño.
3. `rag_memory_search(...)` - Para preguntar sobre lo que acabas de guardar.
