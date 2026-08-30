# IronMind 360 — Serviço ML preditivo

Serviço Python separado (Fase 5 do roadmap), isolado do backend, que expõe
previsões de carga/overtraining, detecção de anomalias e previsão de prova.
Comunica-se com o backend via HTTP/JSON interno na rede `ironmind_internal`.

**Bloco 1 (atual): infraestrutura.** Serviço no ar, pipeline de features,
versionamento de artefatos e cache — sem modelos preditivos ainda. Começa com
scikit-learn/XGBoost; TensorFlow (LSTM/Autoencoder) fica para quando a
complexidade justificar.

## Stack
- FastAPI + Uvicorn (porta 8100), Python 3.12.
- pymongo (leitura direta das coleções para o pipeline de features).
- redis (cache de inferência, fail-open).
- pandas/numpy/scikit-learn/xgboost.

## Endpoints
- `GET /health` — status Mongo/Redis (usado pelo healthcheck do Compose).
- `GET /features/{user_id}` — features extraídas (ACWR, sono, RPE). Requer `X-ML-Token`.
- `POST /retrain` — registra nova versão de modelo (scaffold). Requer `X-ML-Token`.
- `GET /models/{name}/versions` — lista versões. Requer `X-ML-Token`.
- `POST /overtraining-risk` · `/anomalies` · `/race-prediction` — `501` (blocos 2–4).

O backend expõe proxies autenticados em `/api/v1/ml/*` (ver `backend/app/routes/ml.py`).

## Variáveis de ambiente
`MONGO_URL`, `DB_NAME`, `REDIS_URL` (opcional), `ML_SERVICE_TOKEN`,
`MODEL_DIR` (default `/app/models`), `INFERENCE_CACHE_TTL` (default 900s), `ML_PORT`.

## Testes
```bash
# na raiz do serviço, sem depender do stack
cd ml && pip install -r requirements.txt && python -m pytest
```

## Subir via Compose
```bash
docker compose up --build -d ml
curl -s http://localhost:8100/health
```
