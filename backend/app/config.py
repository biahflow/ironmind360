import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def _csv(name: str, default: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in os.getenv(name, default).split(",") if item.strip())


@dataclass(frozen=True, slots=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    app_name: str = os.getenv("APP_NAME", "IronMind 360 API")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    mongo_url: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    db_name: str = os.getenv("DB_NAME", "ironmind360")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    jwt_secret: str = os.getenv(
        "JWT_SECRET", "development-only-secret-change-before-production"
    )
    access_token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
    refresh_token_days: int = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
    cors_origins: tuple[str, ...] = _csv(
        "CORS_ORIGINS", "http://localhost:8081,http://localhost:19006"
    )
    emergent_llm_key: str | None = os.getenv("EMERGENT_LLM_KEY") or None
    coach_provider: str = os.getenv("COACH_MODEL_PROVIDER", "anthropic")
    coach_model: str = os.getenv("COACH_MODEL_NAME", "claude-sonnet-5")
    vision_provider: str = os.getenv("VISION_MODEL_PROVIDER", "openai")
    vision_model: str = os.getenv("VISION_MODEL_NAME", "gpt-5.4")
    app_storage_name: str = os.getenv("APP_STORAGE_NAME", "ironmind360")
    s3_endpoint_url: str = os.getenv("S3_ENDPOINT_URL", "http://localhost:9000")
    s3_bucket: str = os.getenv("S3_BUCKET", "ironmind360")
    s3_access_key: str = os.getenv("S3_ACCESS_KEY", "ironmind-local")
    s3_secret_key: str = os.getenv("S3_SECRET_KEY", "local-only-change-me")
    s3_region: str = os.getenv("S3_REGION", "us-east-1")
    encryption_key_provider: str = os.getenv("ENCRYPTION_KEY_PROVIDER", "local-disabled")
    s3_sse_algorithm: str | None = os.getenv("S3_SSE_ALGORITHM") or None
    s3_kms_key_id: str | None = os.getenv("S3_KMS_KEY_ID") or None
    integration_proxy_url: str = os.getenv(
        "INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com"
    )
    smtp_host: str = os.getenv("SMTP_HOST", "localhost")
    smtp_port: int = int(os.getenv("SMTP_PORT", "1025"))
    smtp_from: str = os.getenv("SMTP_FROM", "no-reply@ironmind.local")
    app_public_url: str = os.getenv("APP_PUBLIC_URL", "http://localhost:8081")
    ml_service_url: str = os.getenv("ML_SERVICE_URL", "http://localhost:8100")
    ml_service_token: str | None = os.getenv("ML_SERVICE_TOKEN") or None
    stripe_secret_key: str | None = os.getenv("STRIPE_SECRET_KEY") or None
    stripe_webhook_secret: str | None = os.getenv("STRIPE_WEBHOOK_SECRET") or None
    stripe_commission_percent: int = int(os.getenv("STRIPE_COMMISSION_PERCENT", "10"))

    def validate(self) -> None:
        if self.app_env.lower() in {"production", "prod"}:
            if "localhost" in self.ml_service_url or not self.ml_service_token:
                raise RuntimeError(
                    "ML_SERVICE_URL interno e ML_SERVICE_TOKEN sao obrigatorios em producao"
                )
            if len(self.jwt_secret) < 32 or "development" in self.jwt_secret:
                raise RuntimeError("JWT_SECRET forte e exclusivo e obrigatorio em producao")
            if "*" in self.cors_origins:
                raise RuntimeError("CORS_ORIGINS nao pode conter '*' em producao")
            if self.encryption_key_provider == "local-disabled":
                raise RuntimeError("Provider externo de chaves e obrigatorio em producao")
            if self.s3_sse_algorithm != "aws:kms" or not self.s3_kms_key_id:
                raise RuntimeError("S3 com aws:kms e key id externo e obrigatorio em producao")
            if self.stripe_secret_key and not self.stripe_webhook_secret:
                raise RuntimeError("STRIPE_WEBHOOK_SECRET e obrigatorio quando STRIPE_SECRET_KEY esta configurado")


settings = Settings()
settings.validate()
