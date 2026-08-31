#!/usr/bin/env bash
# Derruba tudo que o gym-up.sh subiu: túnel Cloudflare, Expo/Metro e (opcional) o stack Docker.
#
# Uso:   ./gym-down.sh            # derruba túnel + Expo, mantém o Docker de pé
#        ./gym-down.sh --docker   # também derruba o stack Docker (docker compose down)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT/.gym-tunnel.pid"

echo "→ Encerrando o túnel Cloudflare..."
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
fi
pkill -f "cloudflared tunnel --url http://localhost:8000" 2>/dev/null || true
rm -f "$PID_FILE"
echo "  Túnel encerrado."

echo "→ Encerrando o Expo/Metro (se estiver aberto)..."
pkill -f "expo start" 2>/dev/null && echo "  Expo encerrado." || echo "  Nada rodando."

if [ "${1:-}" = "--docker" ]; then
  echo "→ Derrubando o stack Docker..."
  (cd "$ROOT" && docker compose down)
  echo "  Stack Docker parado."
else
  echo "→ Stack Docker mantido de pé (use ./gym-down.sh --docker para pará-lo)."
fi

echo "✓ Pronto."
