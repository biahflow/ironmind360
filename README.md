# IronMind 360

Aplicacao de acompanhamento para atletas de triatlo. O ambiente local usa Expo no
host e Docker Compose para API, worker, MongoDB, Redis, MinIO e Mailpit.

## Ambiente local

Requisitos: Docker com Compose v2 e, para executar o app mobile no host, Node.js
22 + Yarn 1.

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

A API fica em `http://localhost:8000`, o console do MinIO em
`http://localhost:9001` e o Mailpit em `http://localhost:8025`. As credenciais
presentes no `.env.example` servem somente para o ambiente local e devem ser
substituidas fora dele.

Para iniciar também o Expo Web no Compose:

```bash
docker compose --profile web up --build -d
```

## Operacao e testes

```bash
# acompanhar os principais logs
docker compose logs -f api worker

# recriar/verificar o seed sem duplicar dados
docker compose run --rm seed

# executar a suite backend contra a API local
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000 \
  docker compose exec api pytest -n 0

# lint e type checking do frontend no host
cd frontend
yarn lint
yarn tsc --noEmit

# parar preservando os dados
docker compose down

# parar e remover os volumes locais (operacao destrutiva)
docker compose down --volumes
```

O planejamento e o progresso de implementacao ficam registrados em
[`roadmap.md`](./roadmap.md).
