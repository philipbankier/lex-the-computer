from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.content import BookmarkCreate
from app.services import bookmarks as bookmark_svc

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("/")
async def list_bookmarks(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await bookmark_svc.list_bookmarks(db, user.id)


@router.post("/")
async def create_bookmark(body: BookmarkCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await bookmark_svc.create_bookmark(
        db, user.id, type=body.type, name=body.name, target_id=body.target_id, href=body.href
    )


@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deleted = await bookmark_svc.delete_bookmark(db, user.id, bookmark_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return {"ok": True}
