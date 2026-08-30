#!/bin/sh
set -eu

# Aguarda dependências TCP (Mongo obrigatório; Redis opcional). Espelha o
# entrypoint do backend para manter o mesmo comportamento de boot.
python - <<'PY'
import os
import socket
import time
from urllib.parse import urlparse

targets = []
for variable, default_port in (("MONGO_URL", 27017), ("REDIS_URL", 6379)):
    value = os.getenv(variable)
    if value:
        parsed = urlparse(value)
        targets.append((parsed.hostname, parsed.port or default_port, variable))

for host, port, name in targets:
    if not host:
        continue
    for attempt in range(30):
        try:
            with socket.create_connection((host, port), timeout=2):
                break
        except OSError:
            if attempt == 29:
                raise RuntimeError(f"{name} indisponivel em {host}:{port}")
            time.sleep(1)
PY

exec "$@"
