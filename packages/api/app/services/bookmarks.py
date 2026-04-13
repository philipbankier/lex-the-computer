from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bookmark import Bookmark


async def list_bookmarks(db: AsyncSession, user_id: int) -> list[Bookmark]:
    result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == user_id).order_by(Bookmark.created_at.desc())
    )
    return list(result.scalars().all())


async def create_bookmark(
    db: AsyncSession, user_id: int, *, type: str, name: str, target_id: str | None = None, href: str | None = None
) -> Bookmark:
    bm = Bookmark(user_id=user_id, type=type, name=name, target_id=target_id, href=href)
    db.add(bm)
    await db.commit()
    await db.refresh(bm)
    return bm


async def delete_bookmark(db: AsyncSession, user_id: int, bookmark_id: int) -> bool:
    result = await db.execute(
        select(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == user_id)
    )
    bm = result.scalar_one_or_none()
    if bm is None:
        return False
    await db.delete(bm)
    await db.commit()
    return True
