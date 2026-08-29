from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=60)


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    device_name: str = Field(default="unknown", min_length=1, max_length=120)


class RefreshIn(BaseModel):
    refresh_token: str


class EmailIn(BaseModel):
    email: EmailStr


class ActionTokenIn(BaseModel):
    token: str


class ResetPasswordIn(ActionTokenIn):
    password: str = Field(min_length=8, max_length=128)


class Goals(BaseModel):
    calories: int = 2200
    protein: int = 150
    water_ml: int = 3000
    sleep_hours: float = 7.5


class SettingsIn(BaseModel):
    name: Optional[str] = None
    intervals_api_key: Optional[str] = None
    intervals_athlete_id: Optional[str] = None
    goals: Optional[Goals] = None


class HabitIn(BaseModel):
    date: str
    water_ml: Optional[int] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = Field(default=None, ge=1, le=5)
    meditate: Optional[bool] = None
    read: Optional[bool] = None
    cold_shower: Optional[bool] = None
    mood: Optional[int] = Field(default=None, ge=1, le=5)
    anxiety: Optional[int] = Field(default=None, ge=1, le=5)
    fatigue: Optional[int] = Field(default=None, ge=1, le=5)
    stress: Optional[int] = Field(default=None, ge=1, le=5)
    energy: Optional[int] = Field(default=None, ge=1, le=5)
    motivation: Optional[int] = Field(default=None, ge=1, le=5)
    symptoms: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=2000)
    weight_kg: Optional[float] = Field(default=None, ge=20, le=300)
    waist_cm: Optional[float] = Field(default=None, ge=30, le=250)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)
