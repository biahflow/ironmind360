import hashlib
import logging

from fastapi import HTTPException, Request
from redis.asyncio import Redis

from app.config import settings


logger = logging.getLogger("ironmind.rate_limit")
redis = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)


def rate_limit(bucket: str, limit: int, window_seconds: int):
    script = """
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return current
    """

    async def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        authorization = request.headers.get("Authorization", "")
        identity = hashlib.sha256(f"{client_ip}:{authorization}".encode()).hexdigest()[:24]
        key = f"rate:{bucket}:{identity}"
        try:
            current = int(await redis.eval(script, 1, key, window_seconds))
        except Exception:
            logger.warning("Rate limiter indisponivel", extra={"bucket": bucket})
            return
        if current > limit:
            raise HTTPException(
                429,
                "Muitas requisicoes. Tente novamente em instantes.",
                headers={"Retry-After": str(window_seconds)},
            )

    return dependency
