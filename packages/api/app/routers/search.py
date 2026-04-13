"""
Search router — global search and session search.

Endpoints:
  GET /api/search            global search (skills + workspace files)
  GET /api/search/sessions   search past conversations via Hermes state.db
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services import search_manager
from app.services import session_search_service

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
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not q.strip():
        return {"sessions": []}

    hermes_results = await session_search_service.search_sessions(q, limit=limit)
    if hermes_results:
        return {"sessions": hermes_results}

    pg_results = await search_manager.search_sessions(db, user.id, q, limit=limit)
    return {"sessions": pg_results}
