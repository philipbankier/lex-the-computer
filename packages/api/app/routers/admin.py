import platform

import psutil
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services import admin_manager

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def require_admin(user: User = Depends(get_current_user)):
    if settings.multi_user and user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class UserRoleUpdate(BaseModel):
    role: str | None = None
    is_disabled: bool | None = None


@router.get("/stats")
async def admin_stats(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    stats = await admin_manager.get_stats(db)
    return {
        "system": {
            "cpus": psutil.cpu_count(),
            "totalMemory": psutil.virtual_memory().total,
            "freeMemory": psutil.virtual_memory().available,
            "uptime": int(psutil.boot_time()),
            "platform": platform.system(),
            "arch": platform.machine(),
            "hostname": platform.node(),
        },
        "counts": {"users": stats["total_users"]},
        "multiUser": settings.multi_user,
    }


@router.get("/users")
async def list_users(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    users = await admin_manager.list_users(db)
    return [
        {
            "id": u.id, "email": u.email, "handle": u.handle, "name": u.name,
            "role": u.role, "is_disabled": u.is_disabled, "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/users/{user_id}")
async def get_user_detail(user_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    target = await admin_manager.get_user(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    containers = await admin_manager.list_containers(db) if settings.multi_user else []
    container = next((c for c in containers if c.user_id == user_id), None)
    return {"user": target, "container": container}


@router.patch("/users/{user_id}")
async def update_user(user_id: int, body: UserRoleUpdate, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    target = await admin_manager.update_user(db, user_id, role=body.role, is_disabled=body.is_disabled)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@router.get("/containers")
async def list_containers(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if not settings.multi_user:
        return []
    return await admin_manager.list_containers(db)


@router.post("/containers/{container_id}/start")
async def start_container(container_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    container = await admin_manager.start_container(db, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    return {"ok": True, "status": container.status}


@router.post("/containers/{container_id}/stop")
async def stop_container(container_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    container = await admin_manager.stop_container(db, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    return {"ok": True, "status": container.status}


@router.get("/usage")
async def get_usage(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await admin_manager.get_usage(db)


@router.get("/billing")
async def get_billing(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await admin_manager.get_billing_summary(db)
