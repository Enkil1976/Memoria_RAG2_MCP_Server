#!/usr/bin/env bash
# install.sh — Instalación del servidor RAG v2
# Uso: bash install.sh

set -e

echo "🚀 Instalando RAG v2 Server..."

# ── Python venv ───────────────────────────────────────────────────────────────
if [ ! -d "env" ]; then
    python3 -m venv env
    echo "✅ Virtualenv creado"
fi

source env/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "✅ Dependencias instaladas"

# ── Configuración de entorno ──────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️  .env creado desde .env.example — EDITA las variables antes de iniciar!"
else
    echo "✅ .env ya existe"
fi

# ── Verificar conexión DB ─────────────────────────────────────────────────────
echo ""
echo "🔍 Verificando configuración..."
python3 -c "
from dotenv import load_dotenv
import os
load_dotenv()
key = os.environ.get('GEMINI_API_KEY', '')
db  = os.environ.get('POSTGRES_PASSWORD', '')
if not key or key == 'your_gemini_api_key_here':
    print('❌ GEMINI_API_KEY no configurada en .env')
elif not db or db == 'your_strong_password_here':
    print('❌ POSTGRES_PASSWORD no configurada en .env')
else:
    print('✅ Variables de entorno configuradas correctamente')
"

echo ""
echo "Para iniciar el servidor:"
echo "  source env/bin/activate"
echo "  python3 rag_v2_api.py"
echo ""
echo "Para instalar como servicio systemd:"
echo "  sudo bash install-service.sh"
