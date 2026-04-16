# Referencia de API y Herramientas MCP

El sistema expone herramientas a través del protocolo MCP y una API REST para integración directa.

## Herramientas MCP (Tools)

### `rag_memory_write`
Guarda una nueva memoria.
- **`title`**: (string) Título de la memoria.
- **`content`**: (string) Contenido (soporta Markdown).
- **`tags`**: (array de strings) Etiquetas para filtrado.
- **`memory_type`**: (enum) `architecture`, `decision`, `bug`, `pattern`, `feature`, `api`, `note`.
- **`project_id`**: (string, opcional) ID del proyecto para aislamiento.

### `rag_memory_search`
Búsqueda vectorial semántica.
- **`query`**: (string) Consulta en lenguaje natural.
- **`limit`**: (int, opcional) Máximo de resultados.
- **`project_id`**: (string, opcional) Filtrar búsqueda por proyecto.

### `rag_project_list`
Lista los proyectos que tienen memorias almacenadas en la base de datos.

### `rag_project_init`
Inicializa un proyecto nuevo. Inserta una memoria de tipo `architecture` con la descripción del proyecto.

### `rag_health`
Retorna el estado del backend, el modelo utilizado y la versión.

## API REST (Endpoint del RAG Server)

El servidor FastAPI escucha por defecto en el puerto `5001`.

- `GET /api/health`: Estado del sistema.
- `GET /api/projects`: Listado de proyectos.
- `POST /api/memories`: Crear memoria.
- `POST /api/search`: Búsqueda semántica.
