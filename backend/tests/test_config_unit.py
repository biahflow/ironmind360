from dataclasses import replace

import pytest

from app.config import settings


def test_production_requires_external_encryption_keys():
    production = replace(
        settings,
        app_env="production",
        jwt_secret="a-production-secret-longer-than-thirty-two-characters",
        cors_origins=("https://app.example.com",),
        encryption_key_provider="local-disabled",
        s3_sse_algorithm=None,
        s3_kms_key_id=None,
    )
    with pytest.raises(RuntimeError, match="Provider externo"):
        production.validate()


def test_production_accepts_external_kms_configuration():
    production = replace(
        settings,
        app_env="production",
        jwt_secret="a-production-secret-longer-than-thirty-two-characters",
        cors_origins=("https://app.example.com",),
        encryption_key_provider="aws-kms",
        s3_sse_algorithm="aws:kms",
        s3_kms_key_id="alias/ironmind-production",
    )
    production.validate()
