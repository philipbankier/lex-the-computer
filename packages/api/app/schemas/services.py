from datetime import datetime

from pydantic import BaseModel


class ServiceCreate(BaseModel):
    name: str
    type: str = "http"
    entrypoint: str | None = None
    port: int | None = None
    env_vars: dict | None = None


class ServiceUpdate(BaseModel):
    name: str | None = None
    entrypoint: str | None = None
    port: int | None = None
    env_vars: dict | None = None


class ServiceResponse(BaseModel):
    id: int
    name: str
    type: str
    port: int | None = None
    entrypoint: str | None = None
    working_dir: str | None = None
    env_vars: dict | None = None
    is_running: bool
    public_url: str | None = None
    created_at: datetime


class ServiceLogResponse(BaseModel):
    service_id: int
    lines: list[str]
