from datetime import datetime

from pydantic import BaseModel


class RouteCreate(BaseModel):
    path: str
    type: str = "page"
    code: str = ""
    is_public: bool = False


class RouteUpdate(BaseModel):
    code: str | None = None
    is_public: bool | None = None


class RouteResponse(BaseModel):
    id: int
    path: str
    type: str
    code: str
    is_public: bool
    created_at: datetime
    updated_at: datetime


class RouteVersionResponse(BaseModel):
    id: int
    route_id: int
    code: str
    version: int
    created_at: datetime


class AssetResponse(BaseModel):
    id: int
    filename: str
    path: str
    mime_type: str | None = None
    size: int | None = None
    created_at: datetime


class SettingsUpdate(BaseModel):
    handle: str | None = None
    title: str | None = None
    description: str | None = None
    favicon: str | None = None
    custom_css: str | None = None


class SettingsResponse(BaseModel):
    handle: str | None = None
    title: str | None = None
    description: str | None = None
    favicon: str | None = None
    custom_css: str | None = None
    updated_at: datetime | None = None


class SpaceErrorResponse(BaseModel):
    id: int
    route_id: int
    error: str
    stack: str | None = None
    created_at: datetime
