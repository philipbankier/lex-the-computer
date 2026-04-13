import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.dataset import Dataset

logger = logging.getLogger(__name__)


def _datasets_dir() -> Path:
    d = Path(settings.workspace_dir) / "datasets"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _get_duckdb():
    import duckdb
    return duckdb


async def list_datasets(db: AsyncSession, user_id: int) -> list[Dataset]:
    result = await db.execute(
        select(Dataset).where(Dataset.user_id == user_id).order_by(Dataset.created_at.desc())
    )
    return list(result.scalars().all())


async def get_dataset(db: AsyncSession, user_id: int, dataset_id: int) -> Dataset | None:
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_dataset(
    db: AsyncSession,
    user_id: int,
    name: str,
    file_data: bytes,
    filename: str,
    description: str | None = None,
) -> Dataset:
    datasets_dir = _datasets_dir()
    file_path = datasets_dir / filename
    file_path.write_bytes(file_data)

    schema_def, row_count = _analyze_file(str(file_path))

    ds = Dataset(
        user_id=user_id,
        name=name,
        description=description,
        source=filename,
        file_path=str(file_path),
        schema_def=schema_def,
        row_count=row_count,
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    return ds


async def delete_dataset(db: AsyncSession, user_id: int, dataset_id: int) -> bool:
    ds = await get_dataset(db, user_id, dataset_id)
    if ds is None:
        return False
    if ds.file_path:
        path = Path(ds.file_path)
        if path.exists():
            path.unlink()
    await db.delete(ds)
    await db.commit()
    return True


def run_query(file_path: str, sql: str, limit: int = 1000) -> dict[str, Any]:
    duckdb = _get_duckdb()
    conn = duckdb.connect(":memory:")
    try:
        table_ref = f"read_csv_auto('{file_path}')" if file_path.endswith(".csv") else f"read_json_auto('{file_path}')"
        safe_sql = sql.replace("{table}", table_ref)
        if "limit" not in safe_sql.lower():
            safe_sql += f" LIMIT {limit}"
        result = conn.execute(safe_sql)
        columns = [desc[0] for desc in result.description]
        rows = [list(row) for row in result.fetchall()]
        return {"columns": columns, "rows": rows, "row_count": len(rows)}
    finally:
        conn.close()


def get_preview(file_path: str, limit: int = 100) -> dict[str, Any]:
    duckdb = _get_duckdb()
    conn = duckdb.connect(":memory:")
    try:
        table_ref = f"read_csv_auto('{file_path}')" if file_path.endswith(".csv") else f"read_json_auto('{file_path}')"
        result = conn.execute(f"SELECT * FROM {table_ref} LIMIT {limit}")
        columns = [desc[0] for desc in result.description]
        rows = [list(row) for row in result.fetchall()]

        count_result = conn.execute(f"SELECT COUNT(*) FROM {table_ref}")
        total = count_result.fetchone()[0]

        return {"columns": columns, "rows": rows, "total_rows": total}
    finally:
        conn.close()


def _analyze_file(file_path: str) -> tuple[dict | None, int | None]:
    try:
        duckdb = _get_duckdb()
        conn = duckdb.connect(":memory:")
        table_ref = f"read_csv_auto('{file_path}')" if file_path.endswith(".csv") else f"read_json_auto('{file_path}')"
        result = conn.execute(f"DESCRIBE {table_ref}")
        schema = {row[0]: row[1] for row in result.fetchall()}
        count = conn.execute(f"SELECT COUNT(*) FROM {table_ref}").fetchone()[0]
        conn.close()
        return schema, count
    except Exception as e:
        logger.warning("Failed to analyze dataset %s: %s", file_path, e)
        return None, None
