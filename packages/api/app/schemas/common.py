from pydantic import BaseModel


class OkResponse(BaseModel):
    ok: bool = True


class ErrorDetail(BaseModel):
    error: str
    detail: str | None = None
