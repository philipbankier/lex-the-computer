from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.bookmark import Bookmark

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


class BookmarkCreate(BaseModel):
    type: str = "tab"
    target_id: int | None = None
    name: str | None = None
    href: str | None = None


@router.get("/")
async def list_bookmarks(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bookmark).where(Bookmark.user_id == user.id))
    return result.scalars().all()


@router.post("/")
async def create_bookmark(body: BookmarkCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    bm = Bookmark(user_id=user.id, type=body.type, target_id=body.target_id, name=body.name, href=body.href)
    db.add(bm)
    await db.commit()
    await db.refresh(bm)
    return bm


@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Bookmark).where(Bookmark.id == bookmark_id))
    await db.commit()
    return {"ok": True}
