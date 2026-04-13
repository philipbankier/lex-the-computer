from datetime import datetime

from pydantic import BaseModel


class SiteCreate(BaseModel):
    name: str
    framework: str = "hono"


class SiteResponse(BaseModel):
    id: int
    name: str
    slug: str
    framework: str | None = None
    is_published: bool
    custom_domain: str | None = None
    port: int | None = None
    pid: int | None = None
    created_at: datetime


class SiteFileWrite(BaseModel):
    path: str
    content: str
