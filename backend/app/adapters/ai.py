import base64
import json
from typing import Optional

from fastapi import HTTPException

from app.config import settings

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover
    AsyncOpenAI = None

try:
    from anthropic import AsyncAnthropic
except ImportError:  # pragma: no cover
    AsyncAnthropic = None


FOOD_SYSTEM = (
    "Analise uma refeicao sem diagnosticar ou prescrever. Responda somente JSON: "
    '{"title":"nome", "items":[], "calories":0, "protein_g":0, '
    '"carbs_g":0, "fat_g":0, "health_score":0, "coach_note":"nota"}'
)
FOOD_PROMPT = "Estime os itens e valores nutricionais desta imagem."
MAX_TOKENS = 1500


def _openai() -> "AsyncOpenAI":
    if AsyncOpenAI is None or not settings.openai_api_key:
        raise HTTPException(503, "Provider de IA (OpenAI) nao configurado")
    return AsyncOpenAI(api_key=settings.openai_api_key)


def _anthropic() -> "AsyncAnthropic":
    if AsyncAnthropic is None or not settings.anthropic_api_key:
        raise HTTPException(503, "Provider de IA (Anthropic) nao configurado")
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


def _extract_json(raw: str) -> dict:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1].removeprefix("json").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            raise HTTPException(502, "Resposta invalida do provider de IA")
        return json.loads(raw[start : end + 1])


async def complete_text(
    *, session_id: str, system: str, prompt: str, provider: str, model: str
) -> str:
    if provider == "openai":
        client = _openai()
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        return (resp.choices[0].message.content or "").strip()

    if provider == "anthropic":
        client = _anthropic()
        resp = await client.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        parts = [block.text for block in resp.content if getattr(block, "type", None) == "text"]
        return "".join(parts).strip()

    raise HTTPException(503, "Provider de IA nao configurado")


async def complete_image(
    *, system: str, prompt: str, image_bytes: bytes, provider: str, model: str,
    media_type: str = "image/jpeg",
) -> str:
    b64 = base64.b64encode(image_bytes).decode()

    if provider == "openai":
        client = _openai()
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}},
                    ],
                },
            ],
        )
        return (resp.choices[0].message.content or "").strip()

    if provider == "anthropic":
        client = _anthropic()
        resp = await client.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": media_type, "data": b64},
                        },
                    ],
                }
            ],
        )
        parts = [block.text for block in resp.content if getattr(block, "type", None) == "text"]
        return "".join(parts).strip()

    raise HTTPException(503, "Provider de IA nao configurado")


async def analyze_food_image(
    image_bytes: bytes,
    *,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    raw = await complete_image(
        system=FOOD_SYSTEM,
        prompt=FOOD_PROMPT,
        image_bytes=image_bytes,
        provider=provider or settings.vision_provider,
        model=model or settings.vision_model,
    )
    return _extract_json(raw)
