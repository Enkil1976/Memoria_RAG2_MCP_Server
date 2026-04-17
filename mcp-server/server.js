#!/usr/bin/env node
/**
 * RAG v2 MCP Server — Servidor MCP dedicado para memoria semántica vectorial
 *
 * Protocolo: Model Context Protocol (MCP) JSON-RPC 2.0 sobre stdio
 * Backend:   FastAPI + PostgreSQL + pgvector + Gemini Embedding 2
 *
 * Variables de entorno (o .env):
 *   RAG_URL     URL del servidor RAG v2  (default: http://localhost:5001)
 *   PROJECT_ID  Proyecto por defecto     (default: "default")
 *
 * Uso: node server.js [projectId] [ragUrl]
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
let redis   = null;
try { redis = require('redis'); } catch(e) {}

// ── Cargar .env si existe ─────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length && !k.startsWith('#')) {
        process.env[k.trim()] ??= v.join('=').trim();
      }
    });
}

// ── Configuración ─────────────────────────────────────────────────────────────
const PROJECT_ID  = process.argv[2] || process.env.PROJECT_ID  || 'default';
const RAG_URL     = process.argv[3] || process.env.RAG_URL      || 'http://localhost:5001';
const AGENT_ID    = process.env.AGENT_ID || 'system';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '30000');
const REDIS_URL   = process.env.REDIS_URL || 'redis://localhost:6379';

// ── Redis Setup (Capa 1) ──────────────────────────────────────────────────────
let redisClient = null;
async function initRedis() {
  if (!redis) return;
  try {
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => {});
    await redisClient.connect();
    process.stderr.write(`[rag-v2-mcp] 🔌 Redis sensorial conectado en ${REDIS_URL}\n`);
  } catch (err) {
    redisClient = null;
  }
}
initRedis();

// ── HTTP Helper ───────────────────────────────────────────────────────────────
function ragRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url  = new URL(RAG_URL + path);
    const lib  = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      },
      timeout: REQUEST_TIMEOUT
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`RAG HTTP ${res.statusCode}: ${raw}`));
          } else {
            resolve(JSON.parse(raw));
          }
        } catch {
          reject(new Error(`RAG parse error: ${raw}`));
        }
      });
    });

    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout (${REQUEST_TIMEOUT}ms)`)); });

    if (data) req.write(data);
    req.end();
  });
}

// ── Definición de herramientas MCP ────────────────────────────────────────────
const TOOLS = [
  {
    name: 'rag_memory_write',
    description: 'Escribe una memoria en el RAG v2 con embedding semántico vectorial (Gemini Embedding 2, 1536 dim). Úsalo para persistir decisiones arquitectónicas, bugs, patrones, features o cualquier conocimiento importante del proyecto.',
    inputSchema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'Título descriptivo de la memoria' },
        content:     { type: 'string', description: 'Contenido completo (soporta Markdown)' },
        tags:        { type: 'array',  items: { type: 'string' }, description: 'Tags para categorización' },
        memory_type: { type: 'string', enum: ['architecture','decision','bug','pattern','feature','api','note'], description: 'Tipo semántico de la memoria' },
        project_id:  { type: 'string', description: `Proyecto destino (default: "${PROJECT_ID}")` },
        agent_id:    { type: 'string', description: `ID del agente (default: "${AGENT_ID}")` }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'rag_memory_search',
    description: 'Búsqueda semántica vectorial en RAG v2. Encuentra memorias conceptualmente relacionadas aunque no compartan palabras exactas. Úsalo para recuperar contexto antes de implementar una nueva feature o resolver un bug.',
    inputSchema: {
      type: 'object',
      properties: {
        query:      { type: 'string', description: 'Consulta en lenguaje natural' },
        limit:      { type: 'number', description: 'Número máximo de resultados (default: 5)' },
        project_id: { type: 'string', description: `Proyecto a consultar (default: "${PROJECT_ID}")` },
        agent_id:   { type: 'string', description: 'Opcional: Filtrar o priorizar memorias de este agente' }
      },
      required: ['query']
    }
  },
  {
    name: 'rag_project_list',
    description: 'Lista todos los proyectos activos en el RAG v2 con el conteo de memorias por proyecto.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'rag_project_init',
    description: 'Inicializa un nuevo proyecto en el RAG v2 con una memoria bootstrap. El proyecto queda aislado y disponible para búsquedas semánticas de forma inmediata.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id:  { type: 'string', description: 'ID único del nuevo proyecto' },
        description: { type: 'string', description: 'Descripción inicial del proyecto' }
      },
      required: ['project_id']
    }
  },
  {
    name: 'rag_health',
    description: 'Verifica el estado del servidor RAG v2 (versión, modelo de embeddings, features activos).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'rag_sensory_ingest',
    description: 'Ingesta un mensaje (pensamiento, log o acción efímera) en la memoria sensorial circular de Redis (Capa 1).',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mensaje o acción' },
        project_id: { type: 'string' },
        agent_id: { type: 'string' }
      },
      required: ['message']
    }
  },
  {
    name: 'rag_sensory_context',
    description: 'Recupera los últimos N mensajes de atención inmediata desde Redis sin latencia pesada (Capa 1).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        agent_id: { type: 'string' }
      }
    }
  }
];

// ── Handlers ──────────────────────────────────────────────────────────────────
async function callGeminiFlash(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return resolve(null);

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: '/v1beta/models/gemini-1.5-flash:generateContent?key=' + API_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          const txt = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(txt.trim());
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(data);
    req.end();
  });
}

async function rag_memory_write(args) {
  const project_id = args.project_id || PROJECT_ID;
  const agent_id   = args.agent_id   || AGENT_ID;

  // -- CAPA 3: Detector de Colisión y Upsert Semántico (Gemini Flash) --
  try {
    const searchResult = await ragRequest('POST', '/api/search', {
      query: args.content,
      limit: 1,
      project_id,
      agent_id
    });
    const bestMatch = searchResult.results?.[0];
    if (bestMatch && bestMatch.similarity > 0.90) { // d < 0.1
      const prompt = `Evalúa si la nueva memoria CONTRADICE o ACTUALIZA la memoria existente.
Memoria Existente: "${bestMatch.content}"
Nueva Memoria: "${args.content}"
Si la nueva actualiza, corrige o invalida a la vieja, responde solo "REEMPLAZAR".
Si aportan cosas distintas y pueden coexistir, responde solo "MANTENER".`;

      const decision = await callGeminiFlash(prompt);
      if (decision && decision.includes('REEMPLAZAR')) {
        await ragRequest('DELETE', `/api/memories/${bestMatch.id}`);
        process.stderr.write(`[rag-v2-mcp] 🔄 Colisión semántica: Reemplazado vector ID ${bestMatch.id}\n`);
      }
    }
  } catch (err) {
    process.stderr.write(`[rag-v2-mcp] ⚠️ Falla en validación semántica (procediendo con insert normal): ${err.message}\n`);
  }

  const result = await ragRequest('POST', '/api/memories', {
    title:       args.title,
    content:     args.content,
    tags:        args.tags        || [],
    memory_type: args.memory_type || 'note',
    metadata:    {},
    project_id,
    agent_id
  });
  return {
    success:   true,
    memory_id: result.id,
    project_id: result.project_id,
    message: `✅ Memoria "${args.title}" guardada (ID: ${result.id}, proyecto: "${result.project_id}")`
  };
}

async function rag_memory_search(args) {
  const project_id = args.project_id || PROJECT_ID;
  const agent_id   = args.agent_id   || null;
  const result = await ragRequest('POST', '/api/search', {
    query:      args.query,
    limit:      args.limit || 5,
    task_type:  'RETRIEVAL_QUERY',
    project_id,
    agent_id
  });
  return {
    results: (result.results || []).map(r => ({
      ...r,
      similarity_label: r.similarity > 0.7 ? '🟢 Alta' : r.similarity > 0.5 ? '🟡 Media' : '🔴 Baja'
    })),
    count:      (result.results || []).length,
    project_id,
    query:      args.query
  };
}

async function rag_project_list() {
  const result = await ragRequest('GET', '/api/projects');
  return { projects: result.projects, total: result.projects.length };
}

async function rag_project_init(args) {
  const result = await ragRequest('POST', '/api/memories', {
    title:       `[INIT] ${args.project_id}`,
    content:     args.description || `Proyecto ${args.project_id} — inicializado en RAG v2`,
    tags:        ['init', 'bootstrap'],
    memory_type: 'architecture',
    metadata:    { initializedAt: new Date().toISOString() },
    project_id:  args.project_id
  });
  return {
    success:             true,
    project_id:          args.project_id,
    bootstrap_memory_id: result.id,
    message: `✅ Proyecto "${args.project_id}" inicializado en RAG v2`
  };
}

async function rag_health() {
  const result = await ragRequest('GET', '/api/health');
  return { ...result, rag_url: RAG_URL, connected_project: PROJECT_ID };
}

async function rag_sensory_ingest(args) {
  if (!redisClient) return { success: false, message: 'Redis no disponible' };
  const pid = args.project_id || PROJECT_ID;
  const aid = args.agent_id || AGENT_ID;
  const key = `sensory_stream:${pid}:${aid}`;
  await redisClient.lPush(key, JSON.stringify({ ts: Date.now(), msg: args.message }));
  await redisClient.lTrim(key, 0, 99);
  return { success: true, message: 'Ingestado en memoria buffer circular' };
}

async function rag_sensory_context(args) {
  if (!redisClient) return { context: [] };
  const pid = args.project_id || PROJECT_ID;
  const aid = args.agent_id || AGENT_ID;
  const key = `sensory_stream:${pid}:${aid}`;
  const data = await redisClient.lRange(key, 0, 49);
  return { context: data.map(d => JSON.parse(d)) };
}

async function callTool(name, args) {
  switch (name) {
    case 'rag_memory_write':  return rag_memory_write(args);
    case 'rag_memory_search': return rag_memory_search(args);
    case 'rag_project_list':  return rag_project_list();
    case 'rag_project_init':  return rag_project_init(args);
    case 'rag_health':        return rag_health();
    case 'rag_sensory_ingest':return rag_sensory_ingest(args);
    case 'rag_sensory_context':return rag_sensory_context(args);
    default: throw new Error(`Herramienta desconocida: ${name}`);
  }
}

// ── MCP Protocol ──────────────────────────────────────────────────────────────
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');

function sendResponse(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message, data) {
  send({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
}

async function handleRequest(req) {
  const { method, params, id } = req;
  if (id === undefined || id === null) return; // Notifications

  try {
    switch (method) {
      case 'initialize':
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'rag-v2-mcp', version: '1.1.0' }
        });
        break;
      case 'tools/list':
        sendResponse(id, { tools: TOOLS });
        break;
      case 'tools/call': {
        const result = await callTool(params.name, params.arguments || {});
        sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
        break;
      }
      case 'ping':
        sendResponse(id, {});
        break;
      default:
        sendError(id, -32601, `Método desconocido: ${method}`);
    }
  } catch (err) {
    process.stderr.write(`[rag-v2-mcp] ❌ ${method} → ${err.message}\n`);
    sendError(id, -32603, err.message);
  }
}

// ── Entrada stdio ─────────────────────────────────────────────────────────────
process.stderr.write(`[rag-v2-mcp] 🚀 Iniciando — Proyecto: ${PROJECT_ID} | RAG: ${RAG_URL}\n`);

let buffer = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      await handleRequest(JSON.parse(t));
    } catch (err) {
      process.stderr.write(`[rag-v2-mcp] Parse error: ${err.message}\n`);
      sendError(null, -32700, 'Parse error');
    }
  }
});

process.stdin.on('end', () => {
  process.stderr.write('[rag-v2-mcp] stdin cerrado — saliendo.\n');
  process.exit(0);
});
