from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services import search_manager

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/")
async def global_search(
    q: str = Query(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not q.strip():
        return {"files": [], "skills": []}

    results = await search_manager.global_search(db, user.id, q)
    skills = [r for r in results if r["type"] == "skill"]
    files = [r for r in results if r["type"] == "file"]
    return {"files": files[:10], "skills": skills}


@router.get("/sessions")
async def search_sessions(
    q: str = Query(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not q.strip():
        return {"sessions": []}

    sessions = await search_manager.search_sessions(db, user.id, q)
    return {"sessions": sessions}
