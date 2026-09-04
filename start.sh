#!/usr/bin/env bash
# start.sh — inicia o backend do Agent Mission Control com auth configurada.
# Credenciais vêm de .env (não versionado, ver .gitignore). Uso: bash start.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

exec python3 server.py
