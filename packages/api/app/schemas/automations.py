from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AutomationCreate(BaseModel):
    name: str
    instruction: str
    schedule: str
    delivery: str


class AutomationUpdate(BaseModel):
    name: str | None = None
    instruction: str | None = None
    schedule: str | None = None
    delivery: str | None = None
    enabled: bool | None = None


class AutomationResponse(BaseModel):
    id: str
    name: str
    instruction: str
    schedule: str
    delivery: str
    enabled: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
