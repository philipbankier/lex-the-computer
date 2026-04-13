import json
import logging
import shutil
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.skill import Skill, SkillsHub

logger = logging.getLogger(__name__)


def _skills_dir() -> Path:
    d = Path(settings.workspace_dir) / "skills"
    d.mkdir(parents=True, exist_ok=True)
    return d


async def list_skills(db: AsyncSession, user_id: int) -> list[Skill]:
    result = await db.execute(
        select(Skill).where(Skill.user_id == user_id).order_by(Skill.created_at.desc())
    )
    return list(result.scalars().all())


async def get_skill(db: AsyncSession, user_id: int, skill_id: int) -> Skill | None:
    result = await db.execute(
        select(Skill).where(Skill.id == skill_id, Skill.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_skill(
    db: AsyncSession,
    user_id: int,
    *,
    name: str,
    description: str | None = None,
    author: str | None = None,
    version: str | None = "0.1.0",
    icon: str | None = None,
) -> Skill:
    skill_dir = _skills_dir() / name.lower().replace(" ", "-")
    skill_dir.mkdir(parents=True, exist_ok=True)

    skill_md = f"# {name}\n\n{description or ''}\n"
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")

    skill = Skill(
        user_id=user_id,
        name=name,
        description=description,
        author=author,
        version=version,
        icon=icon,
        directory=str(skill_dir),
        source="local",
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


async def toggle_skill(db: AsyncSession, user_id: int, skill_id: int) -> Skill | None:
    skill = await get_skill(db, user_id, skill_id)
    if skill is None:
        return None
    skill.is_active = not skill.is_active
    await db.commit()
    await db.refresh(skill)
    return skill


async def delete_skill(db: AsyncSession, user_id: int, skill_id: int) -> bool:
    skill = await get_skill(db, user_id, skill_id)
    if skill is None:
        return False
    if skill.directory:
        skill_dir = Path(skill.directory)
        if skill_dir.exists():
            shutil.rmtree(skill_dir)
    await db.delete(skill)
    await db.commit()
    return True


async def list_hub_skills(
    db: AsyncSession, *, search: str | None = None, tag: str | None = None, limit: int = 50
) -> list[SkillsHub]:
    q = select(SkillsHub)
    if search:
        q = q.where(SkillsHub.name.ilike(f"%{search}%"))
    if tag:
        q = q.where(SkillsHub.tags.ilike(f"%{tag}%"))
    q = q.order_by(SkillsHub.downloads.desc()).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_hub_skill(db: AsyncSession, hub_id: int) -> SkillsHub | None:
    result = await db.execute(select(SkillsHub).where(SkillsHub.id == hub_id))
    return result.scalar_one_or_none()


async def install_from_hub(db: AsyncSession, user_id: int, hub_id: int) -> Skill | None:
    hub_skill = await get_hub_skill(db, hub_id)
    if hub_skill is None:
        return None

    skill_dir = _skills_dir() / hub_skill.name.lower().replace(" ", "-")
    skill_dir.mkdir(parents=True, exist_ok=True)

    if hub_skill.skill_md:
        (skill_dir / "SKILL.md").write_text(hub_skill.skill_md, encoding="utf-8")
    if hub_skill.readme:
        (skill_dir / "README.md").write_text(hub_skill.readme, encoding="utf-8")

    skill = Skill(
        user_id=user_id,
        name=hub_skill.name,
        description=hub_skill.description,
        author=hub_skill.author,
        version=hub_skill.version,
        icon=hub_skill.icon,
        directory=str(skill_dir),
        source="hub",
        hub_id=hub_id,
    )
    db.add(skill)

    hub_skill.downloads = (hub_skill.downloads or 0) + 1

    await db.commit()
    await db.refresh(skill)
    return skill


async def list_hub_tags(db: AsyncSession) -> list[str]:
    result = await db.execute(select(SkillsHub.tags).where(SkillsHub.tags.isnot(None)))
    tags = set()
    for (tag_str,) in result:
        try:
            for t in json.loads(tag_str):
                tags.add(t)
        except (json.JSONDecodeError, TypeError):
            pass
    return sorted(tags)
