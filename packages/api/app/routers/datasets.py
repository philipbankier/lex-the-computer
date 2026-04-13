from pathlib import Path

import duckdb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.dataset import Dataset
from app.models.user import User
from app.services import dataset_manager

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


class DatasetCreate(BaseModel):
    name: str
    description: str = ""
    data: str
    filename: str = "data.csv"


class QueryRequest(BaseModel):
    sql: str


@router.get("/")
async def list_datasets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await dataset_manager.list_datasets(db, user.id)


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ds = await dataset_manager.get_dataset(db, user.id, dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


@router.post("/")
async def create_dataset(body: DatasetCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ds_dir = Path(settings.workspace_dir) / "datasets"
    ds_dir.mkdir(parents=True, exist_ok=True)
    slug = "".join(c if c.isalnum() else "-" for c in body.name.lower()).strip("-")
    db_path = ds_dir / f"{slug}.duckdb"

    ext = body.filename.rsplit(".", 1)[-1].lower() if "." in body.filename else "csv"
    tmp_file = ds_dir / f"_tmp_{slug}.{ext}"
    tmp_file.write_text(body.data)

    try:
        con = duckdb.connect(str(db_path))
        if ext == "json":
            con.execute(f"CREATE TABLE data AS SELECT * FROM read_json_auto('{tmp_file}')")
        else:
            con.execute(f"CREATE TABLE data AS SELECT * FROM read_csv_auto('{tmp_file}')")

        schema_rows = con.execute(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='data'"
        ).fetchall()
        count_row = con.execute("SELECT count(*) FROM data").fetchone()
        row_count = count_row[0] if count_row else 0
        con.close()
    finally:
        tmp_file.unlink(missing_ok=True)

    schema_def = [{"name": r[0], "type": r[1]} for r in schema_rows]
    ds = Dataset(
        user_id=user.id, name=body.name, description=body.description,
        source=body.filename, schema_def=schema_def, row_count=row_count,
        file_path=str(db_path),
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    return ds


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deleted = await dataset_manager.delete_dataset(db, user.id, dataset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"ok": True}


@router.post("/{dataset_id}/query")
async def run_query(dataset_id: int, body: QueryRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ds = await dataset_manager.get_dataset(db, user.id, dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        con = duckdb.connect(str(ds.file_path), read_only=True)
        rows = con.execute(body.sql).fetchdf().to_dict(orient="records")
        columns = list(rows[0].keys()) if rows else []
        con.close()
        return {"rows": rows, "columns": columns}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{dataset_id}/preview")
async def preview_dataset(dataset_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ds = await dataset_manager.get_dataset(db, user.id, dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        con = duckdb.connect(str(ds.file_path), read_only=True)
        rows = con.execute("SELECT * FROM data LIMIT 100").fetchdf().to_dict(orient="records")
        columns = list(rows[0].keys()) if rows else []
        con.close()
        return {"rows": rows, "columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
