import json
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.skill import Skill, SkillsHub

router = APIRouter(prefix="/api/skills", tags=["skills"])

SKILLS_BASE = Path(settings.workspace_dir) / "skills"


class SkillCreate(BaseModel):
    name: str
    description: str = ""


# ── Installed Skills CRUD ────────────────────────────────────────────


@router.get("/")
async def list_skills(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.user_id == user.id))
    return result.scalars().all()


@router.get("/{skill_id}")
async def get_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id).limit(1))
    skill = result.scalar_one_or_none()
    if not skill:
        return {"error": "not found"}, 404

    skill_md = ""
    if skill.directory:
        md_path = Path(skill.directory) / "SKILL.md"
        if md_path.exists():
            skill_md = md_path.read_text()

    return {**skill.__dict__, "skillMdContent": skill_md}


@router.post("/")
async def create_skill(body: SkillCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    if not name:
        return {"error": "name required"}, 400

    slug = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
    skill_dir = SKILLS_BASE / slug
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "scripts").mkdir(exist_ok=True)
    (skill_dir / "references").mkdir(exist_ok=True)
    (skill_dir / "assets").mkdir(exist_ok=True)

    skill_md = f"""---
name: {slug}
description: {body.description or 'A custom skill'}
compatibility:
  - lex
metadata:
  author: user
  version: 1.0.0
  tags: []
  icon: "\u2699\ufe0f"
allowed-tools: []
---

# {name}

Add your skill instructions here. The AI will follow these instructions when this skill is activated.
"""
    (skill_dir / "SKILL.md").write_text(skill_md)

    skill = Skill(
        user_id=user.id, name=name, description=body.description,
        author="user", version="1.0.0", icon="\u2699\ufe0f",
        directory=str(skill_dir), source="local", is_active=True,
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill


@router.put("/{skill_id}/toggle")
async def toggle_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id).limit(1))
    skill = result.scalar_one_or_none()
    if not skill:
        return {"error": "not found"}, 404
    skill.is_active = not skill.is_active
    await db.commit()
    await db.refresh(skill)
    return skill


@router.delete("/{skill_id}")
async def delete_skill(skill_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id).limit(1))
    skill = result.scalar_one_or_none()
    if not skill:
        return {"error": "not found"}, 404
    if skill.directory:
        shutil.rmtree(skill.directory, ignore_errors=True)
    await db.execute(delete(Skill).where(Skill.id == skill_id))
    await db.commit()
    return {"ok": True}


@router.get("/{skill_id}/files")
async def list_skill_files(skill_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id).limit(1))
    skill = result.scalar_one_or_none()
    if not skill or not skill.directory:
        return {"error": "not found"}, 404

    skill_dir = Path(skill.directory)
    files = []
    try:
        for p in skill_dir.rglob("*"):
            files.append({
                "name": p.name,
                "path": str(p.relative_to(skill_dir)),
                "isDirectory": p.is_dir(),
            })
    except Exception:
        pass
    return files


# ── Hub API ──────────────────────────────────────────────────────────


@router.get("/hub/list")
async def hub_list(q: str = Query(""), tags: str = Query(""), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SkillsHub))
    rows = result.scalars().all()

    if q:
        q_lower = q.lower()
        rows = [r for r in rows if q_lower in f"{r.name} {r.description or ''} {r.author or ''}".lower()]

    if tags:
        filter_tags = [t.strip().lower() for t in tags.split(",")]
        def has_tag(r):
            rtags = json.loads(r.tags) if r.tags else []
            return any(ft in [t.lower() for t in rtags] for ft in filter_tags)
        rows = [r for r in rows if has_tag(r)]

    # Mark installed
    installed = (await db.execute(select(Skill).where(Skill.user_id == user.id))).scalars().all()
    installed_hub_ids = {s.hub_id for s in installed if s.hub_id}

    return [
        {**r.__dict__, "tags": json.loads(r.tags) if r.tags else [], "isInstalled": r.id in installed_hub_ids}
        for r in rows
    ]


@router.get("/hub/{hub_id}")
async def hub_detail(hub_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SkillsHub).where(SkillsHub.id == hub_id).limit(1))
    row = result.scalar_one_or_none()
    if not row:
        return {"error": "not found"}, 404
    return {**row.__dict__, "tags": json.loads(row.tags) if row.tags else []}


@router.post("/hub/{hub_id}/install")
async def hub_install(hub_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SkillsHub).where(SkillsHub.id == hub_id).limit(1))
    hub_skill = result.scalar_one_or_none()
    if not hub_skill:
        return {"error": "hub skill not found"}, 404

    # Check already installed
    existing = (await db.execute(
        select(Skill).where(Skill.user_id == user.id, Skill.hub_id == hub_id).limit(1)
    )).scalar_one_or_none()
    if existing:
        return {"error": "already installed"}, 409

    slug = "".join(c if c.isalnum() else "-" for c in hub_skill.name.lower()).strip("-")
    skill_dir = SKILLS_BASE / slug
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "scripts").mkdir(exist_ok=True)
    (skill_dir / "references").mkdir(exist_ok=True)
    (skill_dir / "assets").mkdir(exist_ok=True)

    if hub_skill.skill_md:
        (skill_dir / "SKILL.md").write_text(hub_skill.skill_md)
    if hub_skill.readme:
        (skill_dir / "README.md").write_text(hub_skill.readme)

    skill = Skill(
        user_id=user.id, name=hub_skill.name, description=hub_skill.description,
        author=hub_skill.author, version=hub_skill.version, icon=hub_skill.icon,
        directory=str(skill_dir), source="hub", hub_id=hub_id, is_active=True,
    )
    db.add(skill)

    hub_skill.downloads = (hub_skill.downloads or 0) + 1
    await db.commit()
    await db.refresh(skill)
    return skill


@router.get("/hub/search")
async def hub_search(q: str = Query(""), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SkillsHub))
    rows = result.scalars().all()
    if q:
        q_lower = q.lower()
        rows = [r for r in rows if q_lower in f"{r.name} {r.description or ''} {r.tags or ''}".lower()]
    return [{**r.__dict__, "tags": json.loads(r.tags) if r.tags else []} for r in rows]
