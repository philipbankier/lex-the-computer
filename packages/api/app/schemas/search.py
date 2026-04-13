from pydantic import BaseModel


class SearchResult(BaseModel):
    type: str
    id: str | int
    title: str
    description: str | None = None
    url: str | None = None
    score: float = 0.0


class SessionSearchResult(BaseModel):
    session_key: str
    title: str | None = None
    summary: str | None = None
    rank: float = 0.0
