from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class CoachTone(str, Enum):
    direct = "direct"
    balanced = "balanced"
    supportive = "supportive"


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)
    conversation_id: Optional[str] = None


class ConversationCreateIn(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)


class CoachSettingsIn(BaseModel):
    tone: Optional[CoachTone] = None


class DiaryEntryIn(BaseModel):
    content: str = Field(min_length=1, max_length=5_000)
    mood: Optional[int] = Field(default=None, ge=1, le=5)
    tags: list[str] = Field(default_factory=list, max_length=10)


class ReflectionIn(BaseModel):
    prompt_key: str = Field(min_length=1, max_length=100)
    response: str = Field(min_length=1, max_length=5_000)


class BreathingSessionIn(BaseModel):
    technique: str = Field(min_length=1, max_length=50)
    duration_seconds: int = Field(ge=30, le=3600)
    completed: bool = True
