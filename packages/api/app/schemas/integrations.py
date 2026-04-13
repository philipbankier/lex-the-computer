from datetime import datetime

from pydantic import BaseModel


class TokenCreate(BaseModel):
    provider: str
    access_token: str
    refresh_token: str | None = None
    scope: str | None = None
    account_email: str | None = None
    account_name: str | None = None


class IntegrationResponse(BaseModel):
    id: int
    provider: str
    label: str | None = None
    scope: str | None = None
    permission: str
    account_email: str | None = None
    account_name: str | None = None
    account_avatar: str | None = None
    is_active: bool
    connected_at: datetime


class OAuthStartResponse(BaseModel):
    url: str


class ProviderConfig(BaseModel):
    provider: str
    api_key: str
    base_url: str | None = None
    model: str | None = None


class ProviderResponse(BaseModel):
    id: str
    provider: str
    models: list[str]
    configured: bool
