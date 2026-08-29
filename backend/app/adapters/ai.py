import base64
import json
import uuid

from fastapi import HTTPException

from app.config import settings

try:
    from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage
except ImportError:
    ImageContent = None
    LlmChat = None
    UserMessage = None


def build_chat(session_id: str, system: str, provider: str, model: str):
    if LlmChat is None or not settings.emergent_llm_key:
        raise HTTPException(503, "Provider de IA nao configurado")
    chat = LlmChat(
        api_key=settings.emergent_llm_key,
        session_id=session_id,
        system_message=system,
    )
    chat.with_model(provider, model)
    return chat


async def complete_text(
    *, session_id: str, system: str, prompt: str, provider: str, model: str
) -> str:
    chat = build_chat(session_id, system, provider, model)
    return (await chat.send_message(UserMessage(text=prompt)) or "").strip()


async def analyze_food_image(image_bytes: bytes) -> dict:
    system = (
        "Analise uma refeicao sem diagnosticar ou prescrever. Responda somente JSON: "
        '{"title":"nome", "items":[], "calories":0, "protein_g":0, '
        '"carbs_g":0, "fat_g":0, "health_score":0, "coach_note":"nota"}'
    )
    chat = build_chat(
        f"food-{uuid.uuid4()}", system, settings.vision_provider, settings.vision_model
    )
    message = UserMessage(
        text="Estime os itens e valores nutricionais desta imagem.",
        file_contents=[ImageContent(image_base64=base64.b64encode(image_bytes).decode())],
    )
    raw = (await chat.send_message(message) or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1].removeprefix("json").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            raise HTTPException(502, "Resposta invalida do provider de IA")
        return json.loads(raw[start : end + 1])
