import json
import shutil
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.site import Site

router = APIRouter(prefix="/api/sites", tags=["sites"])

SITES_BASE = Path(settings.workspace_dir) / "sites"


def site_dir(slug: str) -> Path:
    return SITES_BASE / slug


class SiteCreate(BaseModel):
    name: str
    slug: str


class SiteUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    is_published: bool | None = None
    custom_domain: str | None = None


class SiteFileWrite(BaseModel):
    path: str
    content: str = ""


@router.post("/")
async def create_site(body: SiteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    site = Site(user_id=user.id, name=body.name, slug=body.slug, framework="hono", is_published=False)
    db.add(site)
    await db.commit()
    await db.refresh(site)

    # Scaffold files
    d = site_dir(body.slug)
    d.mkdir(parents=True, exist_ok=True)
    index_ts = f"import {{ Hono }} from 'hono';\nconst app = new Hono();\napp.get('/', (c) => c.text('Hello from {body.name}'));\nexport default {{ port: Number(process.env.PORT)||4100, fetch: app.fetch }};\n"
    pkg = {"name": body.slug, "private": True, "type": "module", "scripts": {"dev": "bun run index.ts", "start": "bun run index.ts"}, "dependencies": {"hono": "^4.5.7"}}
    cfg = {"name": body.name, "slug": body.slug, "framework": "hono", "entrypoint": "bun run index.ts"}
    (d / "index.ts").write_text(index_ts)
    (d / "package.json").write_text(json.dumps(pkg, indent=2))
    (d / "lexsite.json").write_text(json.dumps(cfg, indent=2))
    return site


@router.get("/")
async def list_sites(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.user_id == user.id))
    return result.scalars().all()


@router.get("/{site_id}")
async def get_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id).limit(1))
    site = result.scalar_one_or_none()
    if not site:
        return {"error": "not found"}, 404
    return site


@router.patch("/{site_id}")
async def update_site(site_id: int, body: SiteUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id).limit(1))
    site = result.scalar_one_or_none()
    if not site:
        return {"error": "not found"}, 404
    for field in ["name", "slug", "is_published", "custom_domain"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(site, field, val)
    await db.commit()
    await db.refresh(site)
    return site


@router.delete("/{site_id}")
async def delete_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id).limit(1))
    site = result.scalar_one_or_none()
    if site:
        d = site_dir(site.slug)
        shutil.rmtree(d, ignore_errors=True)
    await db.execute(delete(Site).where(Site.id == site_id))
    await db.commit()
    return {"ok": True}


# Lifecycle stubs — will be wired to site_runner.py
@router.post("/{site_id}/publish")
async def publish_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id).limit(1))
    site = result.scalar_one_or_none()
    if site:
        site.is_published = True
        await db.commit()
    return {"ok": True, "status": "published"}


@router.post("/{site_id}/unpublish")
async def unpublish_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id).limit(1))
    site = result.scalar_one_or_none()
    if site:
        site.is_published = False
        await db.commit()
    return {"ok": True}


@router.post("/{site_id}/restart")
async def restart_site(site_id: int, user: User = Depends(get_current_user)):
    return {"ok": True, "status": "restarted"}


@router.get("/{site_id}/files")
async def list_site_files(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id).limit(1))
    site = result.scalar_one_or_none()
    if not site:
        return {"error": "not found"}, 404
    d = site_dir(site.slug)
    entries = []
    if d.exists():
        for entry in d.iterdir():
            entries.append({"name": entry.name, "type": "dir" if entry.is_dir() else "file"})
    return {"entries": entries}


@router.get("/{site_id}/files/content")
async def read_site_file(site_id: int, path: str = Query(""), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id).limit(1))
    site = result.scalar_one_or_none()
    if not site:
        return {"error": "not found"}, 404
    base = site_dir(site.slug)
    abs_path = (base / path).resolve()
    if not str(abs_path).startswith(str(base.resolve())):
        return {"error": "invalid path"}, 400
    try:
        async with aiofiles.open(abs_path, "r") as f:
            content = await f.read()
    except Exception:
        return {"error": "read failed"}, 404
    return {"path": path, "content": content}


@router.post("/{site_id}/files/content")
async def write_site_file(site_id: int, body: SiteFileWrite, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Site).where(Site.id == site_id).limit(1))
    site = result.scalar_one_or_none()
    if not site:
        return {"error": "not found"}, 404
    base = site_dir(site.slug)
    abs_path = (base / body.path).resolve()
    if not str(abs_path).startswith(str(base.resolve())):
        return {"error": "invalid path"}, 400
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(body.content)
    return {"ok": True}
