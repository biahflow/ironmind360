from typing import Literal, Optional

from pydantic import BaseModel, Field


WearableSource = Literal["apple_health", "health_connect", "intervals_icu"]
WearableDataType = Literal["sleep", "resting_hr", "hrv", "weight", "activity"]


class WearablePermissionIn(BaseModel):
    source: WearableSource
    data_types: list[WearableDataType] = Field(min_length=1, max_length=5)


class WearableDataIn(BaseModel):
    source: WearableSource
    data_type: WearableDataType
    source_id: str = Field(min_length=1, max_length=200)
    timestamp: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    value: dict
    metadata: Optional[dict] = None


class WearableBatchIn(BaseModel):
    source: WearableSource
    items: list[WearableDataIn] = Field(min_length=1, max_length=100)
