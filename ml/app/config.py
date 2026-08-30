import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True, slots=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    app_name: str = os.getenv("ML_APP_NAME", "IronMind 360 ML")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    mongo_url: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name: str = os.getenv("DB_NAME", "ironmind360")
    redis_url: str | None = os.getenv("REDIS_URL") or None

    # Segredo compartilhado com o backend para as chamadas internas.
    ml_service_token: str | None = os.getenv("ML_SERVICE_TOKEN") or None

    # Versionamento de modelos em diretório.
    model_dir: str = os.getenv("MODEL_DIR", "/app/models")

    # Cache de inferência.
    inference_cache_ttl: int = int(os.getenv("INFERENCE_CACHE_TTL", "900"))

    port: int = int(os.getenv("ML_PORT", "8100"))

    def validate(self) -> None:
        if self.app_env.lower() in {"production", "prod"}:
            if not self.ml_service_token or len(self.ml_service_token) < 16:
                raise RuntimeError(
                    "ML_SERVICE_TOKEN forte e obrigatorio em producao"
                )


settings = Settings()
settings.validate()
