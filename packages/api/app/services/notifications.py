from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def list_notifications(
    db: AsyncSession, user_id: int, *, limit: int = 50, unread_only: bool = False
) -> list[Notification]:
    q = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        q = q.where(Notification.read == False)  # noqa: E712
    q = q.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


async def unread_count(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.read == False  # noqa: E712
        )
    )
    return result.scalar() or 0


async def mark_read(db: AsyncSession, user_id: int, notification_id: int) -> bool:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    notif = result.scalar_one_or_none()
    if notif is None:
        return False
    notif.read = True
    await db.commit()
    return True


async def mark_all_read(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read == False)  # noqa: E712
        .values(read=True)
    )
    await db.commit()
    return result.rowcount
