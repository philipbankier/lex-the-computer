import os
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.session_search import SessionSearchIndex
from app.models.skill import Skill


async def global_search(db: AsyncSession, user_id: int, query: str) -> list[dict]:
    results = []

    skill_results = await db.execute(
        select(Skill).where(
            Skill.user_id == user_id,
            Skill.name.ilike(f"%{query}%"),
        ).limit(10)
    )
    for skill in skill_results.scalars():
        results.append({
            "type": "skill",
            "id": skill.id,
            "title": skill.name,
            "description": skill.description,
            "url": f"/skills/{skill.id}",
            "score": 1.0,
        })

    file_results = _search_workspace_files(query)
    for fr in file_results[:10]:
        results.append({
            "type": "file",
            "id": fr["path"],
            "title": Path(fr["path"]).name,
            "description": fr["path"],
            "url": f"/files?path={fr['path']}",
            "score": 0.8,
        })

    return results


async def search_sessions(db: AsyncSession, user_id: int, query: str, limit: int = 20) -> list[dict]:
    result = await db.execute(
        text(
            """
            SELECT session_key, title, summary,
                   ts_rank(search_vector, plainto_tsquery('english', :query)) AS rank
            FROM session_search_index
            WHERE user_id = :user_id
              AND search_vector @@ plainto_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :limit
            """
        ),
        {"user_id": user_id, "query": query, "limit": limit},
    )
    return [
        {
            "session_key": row.session_key,
            "title": row.title,
            "summary": row.summary,
            "rank": float(row.rank),
        }
        for row in result
    ]


def _search_workspace_files(query: str, max_results: int = 20) -> list[dict]:
    base = Path(settings.workspace_dir)
    if not base.is_dir():
        return []
    results = []
    query_lower = query.lower()
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for fname in files:
            if query_lower in fname.lower():
                fpath = Path(root) / fname
                results.append({"path": str(fpath.relative_to(base))})
                if len(results) >= max_results:
                    return results
    return results
