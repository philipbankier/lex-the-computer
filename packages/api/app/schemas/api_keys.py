from datetime import datetime

from pydantic import BaseModel


class KeyCreate(BaseModel):
    name: str
    expires_in_days: int | None = None


class KeyUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class KeyResponse(BaseModel):
    id: int
    name: str
    key_prefix: str
    is_active: bool
    last_used_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime


class KeyCreateResponse(KeyResponse):
    key: str
