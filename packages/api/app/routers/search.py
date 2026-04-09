import os
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.skill import Skill

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/")
async def global_search(
    q: str = Query(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not q.strip():
        return {"files": [], "skills": []}

    pattern = f"%{q}%"

    # Search skills by name
    result = await db.execute(
        select(Skill)
        .where(Skill.user_id == user.id, Skill.name.ilike(pattern))
        .limit(5)
    )
    skills = result.scalars().all()

    # Search files by name in workspace
    files: list[dict] = []
    work_dir = Path(settings.workspace_dir) / "files"
    if work_dir.exists():
        _search_dir(work_dir, q.lower(), files, Path(settings.workspace_dir))

    return {"files": files[:10], "skills": skills}


def _search_dir(directory: Path, query: str, results: list[dict], base: Path) -> None:
    try:
        for entry in directory.iterdir():
            if len(results) >= 10:
                return
            if query in entry.name.lower():
                results.append({"name": entry.name, "path": str(entry.relative_to(base))})
            if entry.is_dir() and not entry.name.startswith("."):
                _search_dir(entry, query, results, base)
    except PermissionError:
        pass
