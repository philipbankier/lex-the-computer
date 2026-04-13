import asyncio
import logging
import os
import re
import shutil
import signal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.site import Site

logger = logging.getLogger(__name__)

HONO_TEMPLATE_INDEX = """import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.html('<h1>Hello from {name}!</h1>'))

export default app
"""

HONO_TEMPLATE_PACKAGE = """{
  "name": "{slug}",
  "scripts": {
    "dev": "bunx --bun hono dev src/index.ts"
  },
  "dependencies": {
    "hono": "^4"
  }
}
"""


def _sites_dir() -> Path:
    return Path(settings.workspace_dir) / "sites"


def _site_dir(slug: str) -> Path:
    return _sites_dir() / slug


def _safe_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "site"


async def list_sites(db: AsyncSession, user_id: int) -> list[Site]:
    result = await db.execute(
        select(Site).where(Site.user_id == user_id).order_by(Site.created_at.desc())
    )
    return list(result.scalars().all())


async def get_site(db: AsyncSession, user_id: int, site_id: int) -> Site | None:
    result = await db.execute(
        select(Site).where(Site.id == site_id, Site.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_site(db: AsyncSession, user_id: int, name: str, framework: str = "hono") -> Site:
    slug = _safe_slug(name)
    site = Site(user_id=user_id, name=name, slug=slug, framework=framework)
    db.add(site)
    await db.commit()
    await db.refresh(site)

    site_dir = _site_dir(slug)
    site_dir.mkdir(parents=True, exist_ok=True)
    src_dir = site_dir / "src"
    src_dir.mkdir(exist_ok=True)
    (src_dir / "index.ts").write_text(
        HONO_TEMPLATE_INDEX.replace("{name}", name), encoding="utf-8"
    )
    (site_dir / "package.json").write_text(
        HONO_TEMPLATE_PACKAGE.replace("{slug}", slug), encoding="utf-8"
    )
    return site


async def delete_site(db: AsyncSession, user_id: int, site_id: int) -> bool:
    site = await get_site(db, user_id, site_id)
    if site is None:
        return False
    await _stop_site_process(site)
    site_dir = _site_dir(site.slug)
    if site_dir.exists():
        shutil.rmtree(site_dir)
    await db.delete(site)
    await db.commit()
    return True


def list_site_files(slug: str) -> list[dict]:
    site_dir = _site_dir(slug)
    if not site_dir.is_dir():
        return []
    entries = []
    for item in sorted(site_dir.rglob("*")):
        if item.is_file():
            rel = str(item.relative_to(site_dir))
            entries.append({
                "path": rel,
                "size": item.stat().st_size,
                "modified": item.stat().st_mtime,
            })
    return entries


def read_site_file(slug: str, file_path: str) -> str:
    site_dir = _site_dir(slug)
    target = (site_dir / file_path).resolve()
    if not str(target).startswith(str(site_dir.resolve())):
        raise ValueError("Path traversal detected")
    if not target.is_file():
        raise FileNotFoundError(f"File not found: {file_path}")
    return target.read_text(encoding="utf-8", errors="replace")


def write_site_file(slug: str, file_path: str, content: str) -> None:
    site_dir = _site_dir(slug)
    target = (site_dir / file_path).resolve()
    if not str(target).startswith(str(site_dir.resolve())):
        raise ValueError("Path traversal detected")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


async def publish_site(db: AsyncSession, site: Site) -> Site:
    site_dir = _site_dir(site.slug)
    if not site_dir.exists():
        raise FileNotFoundError(f"Site directory not found: {site.slug}")

    port = site.port or _allocate_port()
    pid = await _start_site_process(site.slug, port)
    site.is_published = True
    site.port = port
    site.pid = pid
    await db.commit()
    await db.refresh(site)
    return site


async def unpublish_site(db: AsyncSession, site: Site) -> Site:
    await _stop_site_process(site)
    site.is_published = False
    site.pid = None
    await db.commit()
    await db.refresh(site)
    return site


async def restart_site(db: AsyncSession, site: Site) -> Site:
    await _stop_site_process(site)
    if site.port:
        pid = await _start_site_process(site.slug, site.port)
        site.pid = pid
        await db.commit()
        await db.refresh(site)
    return site


def _allocate_port() -> int:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


async def _start_site_process(slug: str, port: int) -> int | None:
    site_dir = _site_dir(slug)
    try:
        proc = await asyncio.create_subprocess_exec(
            "bun", "run", "dev", "--port", str(port),
            cwd=str(site_dir),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        return proc.pid
    except Exception as e:
        logger.error("Failed to start site %s: %s", slug, e)
        return None


async def _stop_site_process(site: Site) -> None:
    if site.pid:
        try:
            os.kill(site.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
