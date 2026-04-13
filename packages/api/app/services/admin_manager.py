import platform
import shutil
from datetime import datetime, timezone

import psutil
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.container import UserContainer
from app.models.usage import UsageRecord
from app.models.user import User


async def get_stats(db: AsyncSession) -> dict:
    user_count = await db.execute(select(func.count(User.id)))
    disk = shutil.disk_usage(settings.workspace_dir)
    return {
        "total_users": user_count.scalar() or 0,
        "active_sessions": 0,
        "storage_used_mb": round((disk.total - disk.free) / 1024 / 1024, 1),
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": psutil.virtual_memory().percent,
    }


async def list_users(db: AsyncSession, *, limit: int = 100, offset: int = 0) -> list[User]:
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(
    db: AsyncSession, user_id: int, *, role: str | None = None, is_disabled: bool | None = None
) -> User | None:
    user = await get_user(db, user_id)
    if user is None:
        return None
    if role is not None:
        user.role = role
    if is_disabled is not None:
        user.is_disabled = is_disabled
    await db.commit()
    await db.refresh(user)
    return user


async def list_containers(db: AsyncSession) -> list[UserContainer]:
    result = await db.execute(
        select(UserContainer).order_by(UserContainer.created_at.desc())
    )
    return list(result.scalars().all())


async def start_container(db: AsyncSession, container_id: int) -> UserContainer | None:
    result = await db.execute(
        select(UserContainer).where(UserContainer.id == container_id)
    )
    container = result.scalar_one_or_none()
    if container is None:
        return None
    container.status = "running"
    container.last_active_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(container)
    return container


async def stop_container(db: AsyncSession, container_id: int) -> UserContainer | None:
    result = await db.execute(
        select(UserContainer).where(UserContainer.id == container_id)
    )
    container = result.scalar_one_or_none()
    if container is None:
        return None
    container.status = "stopped"
    await db.commit()
    await db.refresh(container)
    return container


async def get_usage(db: AsyncSession, user_id: int | None = None) -> list[UsageRecord]:
    q = select(UsageRecord)
    if user_id:
        q = q.where(UsageRecord.user_id == user_id)
    q = q.order_by(UsageRecord.created_at.desc()).limit(100)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_billing_summary(db: AsyncSession, user_id: int | None = None) -> dict:
    q = select(func.sum(UsageRecord.amount))
    if user_id:
        q = q.where(UsageRecord.user_id == user_id)
    result = await db.execute(q)
    total = result.scalar() or 0
    return {"total_usage": total, "currency": "usd"}
