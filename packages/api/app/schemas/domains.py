from datetime import datetime

from pydantic import BaseModel


class DomainCreate(BaseModel):
    domain: str
    target_type: str
    target_id: int | None = None


class DomainResponse(BaseModel):
    id: int
    domain: str
    target_type: str
    target_id: int | None = None
    verified: bool
    verification_token: str | None = None
    ssl_status: str
    created_at: datetime
