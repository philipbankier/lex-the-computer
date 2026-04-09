from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.service import Service

router = APIRouter(prefix="/api/services", tags=["services"])


class ServiceCreate(BaseModel):
    name: str
    type: str  # 'http' | 'tcp'
    port: int | None = None
    entrypoint: str | None = None
    working_dir: str | None = None
    env_vars: dict | None = None


class ServiceUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    port: int | None = None
    entrypoint: str | None = None
    working_dir: str | None = None
    env_vars: dict | None = None


@router.post("/")
async def create_service(body: ServiceCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = Service(
        user_id=user.id, name=body.name, type=body.type, port=body.port,
        entrypoint=body.entrypoint, working_dir=body.working_dir,
        env_vars=body.env_vars, is_running=False,
    )
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return svc


@router.get("/")
async def list_services(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Service).where(Service.user_id == user.id))
    return result.scalars().all()


@router.get("/{service_id}")
async def get_service(service_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Service).where(Service.id == service_id).limit(1))
    svc = result.scalar_one_or_none()
    if not svc:
        return {"error": "not found"}, 404
    return svc


@router.patch("/{service_id}")
async def update_service(service_id: int, body: ServiceUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Service).where(Service.id == service_id).limit(1))
    svc = result.scalar_one_or_none()
    if not svc:
        return {"error": "not found"}, 404
    for field in ["name", "type", "port", "entrypoint", "working_dir", "env_vars"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(svc, field, val)
    await db.commit()
    await db.refresh(svc)
    return svc


@router.delete("/{service_id}")
async def delete_service(service_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Service).where(Service.id == service_id))
    await db.commit()
    return {"ok": True}


# Lifecycle stubs — will be implemented in service_runner.py
@router.post("/{service_id}/start")
async def start_service(service_id: int, user: User = Depends(get_current_user)):
    return {"ok": True, "status": "started"}


@router.post("/{service_id}/stop")
async def stop_service(service_id: int, user: User = Depends(get_current_user)):
    return {"ok": True, "status": "stopped"}


@router.post("/{service_id}/restart")
async def restart_service(service_id: int, user: User = Depends(get_current_user)):
    return {"ok": True, "status": "restarted"}


@router.get("/{service_id}/logs")
async def get_service_logs(service_id: int, user: User = Depends(get_current_user)):
    return {"lines": []}
