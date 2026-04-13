"""
Skills router — CRUD backed by Hermes shared volume + Lex product DB.

Hermes-backed (by name):
  GET    /api/skills                list all skills from Hermes volume
  POST   /api/skills                create a skill on Hermes volume
  GET    /api/skills/{name}         read SKILL.md content
  PUT    /api/skills/{name}         update SKILL.md content
  DELETE /api/skills/{name}         delete skill directory

DB-backed (by id, legacy):
  PUT    /api/skills/{skill_id}/toggle   toggle active/inactive
  GET    /api/skills/{skill_id}/files    list files in skill directory

Hub:
  GET    /api/skills/hub/list            browse hub catalog
  GET    /api/skills/hub/search          search hub catalog
  GET    /api/skills/hub/{hub_id}        hub skill detail
  POST   /api/skills/hub/{hub_id}/install  install from hub
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.skill import Skill, SkillsHub
from app.models.user import User
from app.schemas.skills import SkillCreate
from app.services import skill_manager
from app.services import skills_service

router = APIRouter(prefix="/api/skills", tags=["skills"])


class SkillContentUpdate(BaseModel):
    content: str


# ------------------------------------------------------------------
# Hub endpoints (static prefix — must be declared before /{name})
# ------------------------------------------------------------------


@router.get("/hub/list")
async def hub_list(
    q: str = Query(""),
    tags: str = Query(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hub_skills = await skill_manager.list_hub_skills(db, search=q or None)

    if tags:
        filter_tags = [t.strip().lower() for t in tags.split(",")]

        def has_tag(r):
            rtags = json.loads(r.tags) if r.tags else []
            return any(ft in [t.lower() for t in rtags] for ft in filter_tags)

        hub_skills = [r for r in hub_skills if has_tag(r)]

    installed = await skill_manager.list_skills(db, user.id)
    installed_hub_ids = {s.hub_id for s in installed if s.hub_id}

    return [
        {**r.__dict__, "tags": json.loads(r.tags) if r.tags else [], "isInstalled": r.id in installed_hub_ids}
        for r in hub_skills
    ]


@router.get("/hub/search")
async def hub_search(q: str = Query(""), db: AsyncSession = Depends(get_db)):
    results = await skill_manager.list_hub_skills(db, search=q or None)
    return [{**r.__dict__, "tags": json.loads(r.tags) if r.tags else []} for r in results]


@router.get("/hub/{hub_id}")
async def hub_detail(hub_id: int, db: AsyncSession = Depends(get_db)):
    skill = await skill_manager.get_hub_skill(db, hub_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Hub skill not found")
    return {**skill.__dict__, "tags": json.loads(skill.tags) if skill.tags else []}


@router.post("/hub/{hub_id}/install")
async def hub_install(
    hub_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Skill).where(Skill.user_id == user.id, Skill.hub_id == hub_id).limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already installed")

    skill = await skill_manager.install_from_hub(db, user.id, hub_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Hub skill not found")
    return skill


# ------------------------------------------------------------------
# DB sub-path endpoints (two segments — no conflict with /{name})
# ------------------------------------------------------------------


@router.put("/{skill_id}/toggle")
async def toggle_skill(
    skill_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skill = await skill_manager.toggle_skill(db, user.id, skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.get("/{skill_id}/files")
async def list_skill_files(
    skill_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skill = await skill_manager.get_skill(db, user.id, skill_id)
    if not skill or not skill.directory:
        raise HTTPException(status_code=404, detail="Skill not found")
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


# ------------------------------------------------------------------
# Main CRUD — Hermes shared-volume backed (by name)
# ------------------------------------------------------------------


@router.get("/")
async def list_skills(user: User = Depends(get_current_user)):
    return await skills_service.list_skills()


@router.post("/")
async def create_skill(
    body: SkillCreate,
    user: User = Depends(get_current_user),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="name required")
    try:
        return await skills_service.create_skill(
            body.name,
            description=body.description,
            author=body.author,
            version=body.version or "0.1.0",
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{name}")
async def get_skill(name: str, user: User = Depends(get_current_user)):
    try:
        skill = await skills_service.get_skill(name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.put("/{name}")
async def update_skill(
    name: str,
    body: SkillContentUpdate,
    user: User = Depends(get_current_user),
):
    try:
        skill = await skills_service.update_skill(name, body.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.delete("/{name}")
async def delete_skill(name: str, user: User = Depends(get_current_user)):
    try:
        deleted = await skills_service.delete_skill(name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"ok": True}
