from datetime import datetime

from pydantic import BaseModel


class BookmarkCreate(BaseModel):
    type: str
    target_id: str | None = None
    name: str
    href: str | None = None


class BookmarkResponse(BaseModel):
    id: int
    type: str
    target_id: str | None = None
    name: str
    href: str | None = None
    created_at: datetime


class NotificationResponse(BaseModel):
    id: int
    title: str
    body: str | None = None
    type: str
    read: bool
    link: str | None = None
    created_at: datetime


class SecretCreate(BaseModel):
    key: str
    value: str


class SecretResponse(BaseModel):
    id: int
    key: str
    created_at: datetime
