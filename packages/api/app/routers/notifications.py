from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services import notifications as notif_svc

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/")
async def list_notifications(
    limit: int = Query(20),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await notif_svc.list_notifications(db, user.id, limit=limit)


@router.get("/unread-count")
async def unread_count(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = await notif_svc.unread_count(db, user.id)
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await notif_svc.mark_read(db, user.id, notification_id)
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = await notif_svc.mark_all_read(db, user.id)
    return {"ok": True, "updated": count}
