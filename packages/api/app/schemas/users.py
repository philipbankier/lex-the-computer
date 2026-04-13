from datetime import datetime

from pydantic import BaseModel


class ProfileUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    social_links: dict | None = None
    language: str | None = None
    timezone: str | None = None
    share_location: bool | None = None


class AvatarUpdate(BaseModel):
    avatar: str


class ProfileResponse(BaseModel):
    name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    social_links: dict = {}
    language: str = ""
    timezone: str = ""
    share_location: bool = False


class AdminUserResponse(BaseModel):
    id: int
    email: str
    name: str | None = None
    handle: str | None = None
    role: str
    is_disabled: bool
    onboarding_completed: bool
    created_at: datetime


class AdminUserUpdate(BaseModel):
    role: str | None = None
    is_disabled: bool | None = None


class AdminStatsResponse(BaseModel):
    total_users: int
    active_sessions: int
    storage_used_mb: float
    cpu_percent: float
    memory_percent: float
