from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DatasetCreate(BaseModel):
    name: str
    description: str | None = None


class DatasetResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    source: str | None = None
    schema_def: dict | None = None
    row_count: int | None = None
    file_path: str
    created_at: datetime
    updated_at: datetime


class QueryRequest(BaseModel):
    sql: str
    limit: int = 1000


class QueryResponse(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    row_count: int


class DatasetPreview(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    total_rows: int
