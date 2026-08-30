#!/usr/bin/env bash
# Sobe TUDO para testar na academia (Opção 1):
#   1. stack Docker (API, Mongo, Redis, etc.)
#   2. túnel Cloudflare público -> localhost:8000 (URL gravada em frontend/.env)
#   3. Expo com túnel (QR code para o Expo Go)
#
# Uso:   ./gym-up.sh
# Parar: Ctrl+C encerra o Expo; depois rode ./gym-down.sh para derrubar o resto.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/frontend/.env"
PID_FILE="$ROOT/.gym-tunnel.pid"
LOG_FILE="$ROOT/.gym-tunnel.log"

echo "→ [1/3] Subindo o stack Docker..."
docker compose -f "$ROOT/docker-compose.yml" up -d

echo "→ Aguardando a API responder em localhost:8000..."
for _ in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:8000/docs 2>/dev/null && break
  sleep 1
done
if ! curl -sf -o /dev/null http://localhost:8000/docs 2>/dev/null; then
  echo "✗ A API não respondeu. Veja: docker compose logs -f api"
  exit 1
fi
echo "  API no ar."

# Se já houver um túnel antigo rodando, derruba antes.
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
fi

echo "→ [2/3] Ligando o túnel Cloudflare..."
: > "$LOG_FILE"
cloudflared tunnel --url http://localhost:8000 >"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG_FILE" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 0.5
done
if [ -z "$URL" ]; then
  echo "✗ Não consegui obter a URL do túnel. Log:"; cat "$LOG_FILE"
  kill "$(cat "$PID_FILE")" 2>/dev/null || true; rm -f "$PID_FILE"
  exit 1
fi

cat > "$ENV_FILE" <<EOF
# Gerado automaticamente pelo gym-up.sh — não commitar.
# A URL abaixo é reescrita toda vez que você sobe o túnel.
EXPO_PUBLIC_BACKEND_URL=$URL
EOF
echo "  Túnel no ar: $URL"
echo "  Gravado em frontend/.env"

echo "→ [3/3] Abrindo o Expo (escaneie o QR com o Expo Go)..."
echo "  Ctrl+C encerra o Expo. O túnel continua ativo até você rodar ./gym-down.sh."
echo
cd "$ROOT/frontend" && exec yarn start --tunnel
