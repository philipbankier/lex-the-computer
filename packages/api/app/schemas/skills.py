from datetime import datetime

from pydantic import BaseModel


class SkillCreate(BaseModel):
    name: str
    description: str | None = None
    author: str | None = None
    version: str | None = "0.1.0"
    icon: str | None = None


class SkillResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    author: str | None = None
    version: str | None = None
    icon: str | None = None
    directory: str | None = None
    source: str
    hub_id: int | None = None
    is_active: bool
    installed_at: datetime
    created_at: datetime


class HubSkillResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    author: str | None = None
    version: str | None = None
    icon: str | None = None
    tags: str | None = None
    repo_url: str | None = None
    downloads: int
    readme: str | None = None


class SkillInstallRequest(BaseModel):
    hub_id: int
