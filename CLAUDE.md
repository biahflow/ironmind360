# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

IronMind 360 is a triathlon athlete tracking app. The backend is a FastAPI service (MongoDB, Redis/Celery, S3-compatible object storage); the frontend is an Expo / React Native app (iOS, Android, web). User-facing strings are Portuguese (pt-BR) — match that when adding messages.

The entire local environment runs under Docker Compose: API, Celery worker, MongoDB, Redis, MinIO (S3), and Mailpit (SMTP). Only the Expo app is typically run on the host.

## Commands

```bash
# Bring up the full stack (API on :8000, MinIO console :9001, Mailpit :8025)
cp .env.example .env
docker compose up --build -d

# Add Expo Web (served at :8081) to the stack
docker compose --profile web up --build -d

# Idempotent demo seed (safe to re-run)
docker compose run --rm seed

# Tail the important logs
docker compose logs -f api worker

# Tear down (add --volumes to also wipe local data — destructive)
docker compose down
```

### Backend tests, lint, types

The pytest suite is **end-to-end**: it hits a live API over HTTP and depends on the seeded demo user. The API must be running and `EXPO_PUBLIC_BACKEND_URL` must point at it.

```bash
# Full suite (run inside the api container; -n 0 forces serial — see pytest.ini)
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000 \
  docker compose exec api pytest -n 0

# A single test
docker compose exec api pytest -n 0 backend/tests/test_ironmind_api.py::TestAuth::test_login_demo

# Lint + types (as CI runs them)
docker compose exec api flake8 app --max-line-length=120 --extend-ignore=E203,W503
docker compose exec api mypy app --ignore-missing-imports --disable-error-code=import-untyped
```

**Do not modify `backend/pytest.ini` `addopts`.** It pins `-n 2 --dist loadscope` so generated test classes that share the live backend don't race. Run serial with `-n 0` (not `-p no:xdist`, which errors because addopts still passes `-n`). `test_*_unit.py` / `test_config_unit.py` / `test_rbac_unit.py` are true unit tests; the rest require the running stack.

### Frontend (host, Node 22 + Yarn 1)

```bash
cd frontend
yarn install --frozen-lockfile
yarn tsc --noEmit   # type check (strict)
yarn lint           # expo lint
yarn web            # or: yarn ios / yarn android / yarn start
```

CI (`.github/workflows/ci.yml`) runs gitleaks, the backend lint/type/test flow above via Compose, and the frontend type-check + lint.

## Backend architecture

`backend/server.py` is a thin ASGI entrypoint — all behavior lives in the `app/` package. `worker.py` is the Celery entrypoint.

- **App factory** (`app/factory.py`): `create_app(router)` builds the FastAPI app, mounts the router at **both** `/api/v1` (documented) and `/api` (unversioned, hidden from schema), installs CORS and error handlers. `server.py` assembles one `APIRouter` from every module in `app/routes/` and passes it in.
- **Config** (`app/config.py`): a frozen `Settings` dataclass read from env at import time. `settings.validate()` runs on import and **hard-fails in production** (`APP_ENV=production`) unless a strong `JWT_SECRET`, non-`*` CORS origins, an external encryption key provider, and S3 `aws:kms` encryption are all configured. Development defaults are intentionally permissive.
- **Database** (`app/database.py`): a module-level `AsyncMongoClient` (`db`) shared everywhere. The FastAPI `lifespan` pings Mongo and calls `ensure_indexes()` on startup — add new indexes there. Collections are accessed directly as `db.<collection>` (users, sessions, refresh_tokens, action_tokens, activities, habits, meals, files, chat_messages, consents, audit_events, ...).
- **Auth & security** (`app/security.py`, `app/dependencies.py`): JWT (HS256) access tokens (~15 min) + rotating refresh tokens (~30 days), bcrypt password hashing. `issue_token_pair` writes a `sessions` doc and a hashed `refresh_tokens` doc; refresh tokens are stored only as SHA-256 hashes. `current_user` is the auth dependency (validates token → session not revoked → user not deleted); `require_roles(*roles)` builds an RBAC dependency on top of it.
- **RBAC roles** (`app/models/roles.py`): `athlete`, `nutritionist`, `psychologist`, `moderator`, `administrator`. Users default to `["athlete"]`.
- **Adapters** (`app/adapters/`): external providers behind `Protocol` interfaces (`protocols.py`) — `StorageProvider` (S3/MinIO in `storage.py`), `AIProvider`, `EmailProvider`, `IntervalsProvider` (intervals.icu sync). AI (`ai.py`) is routed through the optional `emergentintegrations` SDK and raises 503 if `EMERGENT_LLM_KEY`/the SDK is absent — treat AI as optional in dev. Coach model / vision model are configured via `COACH_MODEL_*` / `VISION_MODEL_*` env vars.
- **Rate limiting** (`app/rate_limit.py`): `rate_limit(bucket, limit, window)` is a Redis-backed (Lua `INCR`+`EXPIRE`) dependency keyed on client IP + Authorization header. It **fails open** — if Redis is down, requests are allowed. Applied per-route via `dependencies=[Depends(rate_limit(...))]`.
- **Other layers**: `app/repositories/` (data access), `app/services/` (audit, discipline, files domain logic), `app/models/` (Pydantic schemas), `app/workers/celery.py` (Celery app), `app/scripts/seed.py` (demo seed), `app/scripts/entrypoint.sh` (waits for Mongo/Redis TCP before exec).

## Frontend architecture

Expo Router with **file-based routing** under `frontend/app/`. `app/(tabs)/` holds the authenticated tab screens (index, workouts, nutrition, coach); `app/login.tsx`, `register.tsx`, `settings.tsx` are top-level routes. `@/*` is a path alias to the frontend root (`tsconfig.json`).

- **API client** (`src/lib/api.ts`): all requests go through `api.get/post/put/del`. It targets `${EXPO_PUBLIC_BACKEND_URL}/api/v1`, injects the bearer token, and on a `401` transparently calls `/auth/refresh` once, persists the new token pair, and retries. Tokens live in secure storage under `ironmind_token` / `ironmind_refresh_token`.
- **Auth state**: `src/context/AuthContext.tsx`.
- `EXPO_PUBLIC_BACKEND_URL` selects the backend; it must be set for both the app and the backend test suite.

## Conventions

- New API routes: add a module in `app/routes/`, expose a `router`, and register it in `server.py`'s router loop. Use `Depends(current_user)` / `require_roles(...)` for auth and add a `rate_limit(...)` dependency for expensive or AI endpoints.
- New Mongo indexes go in `ensure_indexes()` in `app/database.py`.
- Never commit real secrets — CI runs gitleaks, and `.env.example` values are local-only placeholders. Production hardening is enforced by `Settings.validate()`.
