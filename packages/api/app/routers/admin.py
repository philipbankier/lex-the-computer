import platform

import psutil
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.commerce import StripeOrder
from app.models.container import UserContainer
from app.models.usage import UsageRecord

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
    user_count = (await db.execute(select(func.count()).select_from(User))).scalar() or 0

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
        "counts": {"users": user_count},
        "multiUser": settings.multi_user,
    }


@router.get("/users")
async def list_users(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id, "email": u.email, "handle": u.handle, "name": u.name,
            "role": u.role, "is_disabled": u.is_disabled, "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/users/{user_id}")
async def get_user_detail(user_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id).limit(1))
    target = result.scalar_one_or_none()
    if not target:
        return {"error": "Not found"}, 404

    container = None
    if settings.multi_user:
        c_result = await db.execute(select(UserContainer).where(UserContainer.user_id == user_id).limit(1))
        container = c_result.scalar_one_or_none()

    return {"user": target, "container": container}


@router.patch("/users/{user_id}")
async def update_user(user_id: int, body: UserRoleUpdate, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id).limit(1))
    target = result.scalar_one_or_none()
    if not target:
        return {"error": "Not found"}, 404
    if body.role is not None:
        target.role = body.role
    if body.is_disabled is not None:
        target.is_disabled = body.is_disabled
    await db.commit()
    return {"ok": True}


@router.get("/containers")
async def list_containers(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if not settings.multi_user:
        return []
    result = await db.execute(select(UserContainer))
    return result.scalars().all()


@router.post("/containers/{user_id}/start")
async def start_container(user_id: int, user: User = Depends(require_admin)):
    # Stub — will be wired to container_manager.py
    return {"ok": True}


@router.post("/containers/{user_id}/stop")
async def stop_container(user_id: int, user: User = Depends(require_admin)):
    # Stub — will be wired to container_manager.py
    return {"ok": True}


@router.get("/usage")
async def get_usage(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UsageRecord).order_by(UsageRecord.created_at.desc()).limit(100))
    return result.scalars().all()


@router.get("/billing")
async def get_billing(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            func.coalesce(func.sum(StripeOrder.amount), 0).label("total"),
            func.count().label("count"),
        )
        .select_from(StripeOrder)
        .where(StripeOrder.payment_status == "paid")
    )
    row = result.one()
    return {"totalRevenue": int(row.total), "totalOrders": row.count}
