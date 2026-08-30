from typing import Literal

from pydantic import BaseModel, Field


NotificationType = Literal[
    "checkin_reminder", "workout_reminder", "hydration_reminder",
    "equipment_alert", "readiness_alert", "meal_reminder",
    "race_countdown", "weekly_summary",
]


class PushTokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    platform: Literal["ios", "android", "web"] = "ios"


class PushTokenDeleteIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class NotificationPrefsIn(BaseModel):
    checkin_reminder: bool = True
    checkin_time: str = Field(default="07:00", pattern=r"^\d{2}:\d{2}$")
    workout_reminder: bool = True
    hydration_reminder: bool = True
    equipment_alerts: bool = True
    readiness_alerts: bool = True
    meal_reminders: bool = True
    race_countdown: bool = True
    weekly_summary: bool = True
    quiet_start: str = Field(default="22:00", pattern=r"^\d{2}:\d{2}$")
    quiet_end: str = Field(default="07:00", pattern=r"^\d{2}:\d{2}$")
