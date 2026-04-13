"""Skills service — Hermes shared-volume filesystem operations.

Skills live at ``{hermes_data_dir}/skills/{slug}/SKILL.md`` on the shared
Docker volume.  Hermes scans this directory at startup and on change.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any

from app.config import settings


def _hermes_skills_dir() -> Path:
    d = Path(settings.hermes_data_dir) / "skills"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _validate_name(name: str) -> str:
    slug = name.strip().lower().replace(" ", "-")
    if not slug or not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$", slug):
        raise ValueError(f"Invalid skill name: {name!r}")
    return slug


def _parse_frontmatter(content: str) -> tuple[dict[str, str], str]:
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)", content, re.DOTALL)
    if not m:
        return {}, content
    meta: dict[str, str] = {}
    for line in m.group(1).strip().splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            meta[key.strip()] = val.strip().strip("\"'")
    return meta, m.group(2)


def _build_skill_md(
    name: str,
    description: str | None = None,
    author: str | None = None,
    version: str = "0.1.0",
) -> str:
    lines = ["---", f"name: {name}"]
    if description:
        lines.append(f"description: {description}")
    if author:
        lines.append(f"author: {author}")
    lines.append(f"version: {version}")
    lines.extend(["---", "", f"# {name}", ""])
    if description:
        lines.append(description)
        lines.append("")
    return "\n".join(lines)


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------


async def list_skills() -> list[dict[str, Any]]:
    skills_dir = _hermes_skills_dir()
    results: list[dict[str, Any]] = []
    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue
        skill_md = entry / "SKILL.md"
        meta: dict[str, str] = {}
        if skill_md.exists():
            meta, _ = _parse_frontmatter(skill_md.read_text(encoding="utf-8"))
        results.append({
            "name": entry.name,
            "description": meta.get("description"),
            "version": meta.get("version"),
            "author": meta.get("author"),
            "enabled": True,
            "path": str(entry),
        })
    return results


async def get_skill(name: str) -> dict[str, Any] | None:
    slug = _validate_name(name)
    skill_dir = _hermes_skills_dir() / slug
    if not skill_dir.is_dir():
        return None
    skill_md = skill_dir / "SKILL.md"
    content = ""
    meta: dict[str, str] = {}
    if skill_md.exists():
        content = skill_md.read_text(encoding="utf-8")
        meta, _ = _parse_frontmatter(content)
    return {
        "name": slug,
        "description": meta.get("description"),
        "version": meta.get("version"),
        "author": meta.get("author"),
        "content": content,
        "path": str(skill_dir),
    }


async def create_skill(
    name: str,
    *,
    content: str | None = None,
    description: str | None = None,
    author: str | None = None,
    version: str = "0.1.0",
) -> dict[str, Any]:
    slug = _validate_name(name)
    skill_dir = _hermes_skills_dir() / slug
    if skill_dir.exists():
        raise ValueError(f"Skill '{slug}' already exists")
    skill_dir.mkdir(parents=True)

    skill_content = content or _build_skill_md(
        slug, description=description, author=author, version=version,
    )
    (skill_dir / "SKILL.md").write_text(skill_content, encoding="utf-8")

    return {
        "name": slug,
        "description": description,
        "version": version,
        "author": author,
        "content": skill_content,
        "path": str(skill_dir),
    }


async def update_skill(name: str, content: str) -> dict[str, Any] | None:
    slug = _validate_name(name)
    skill_dir = _hermes_skills_dir() / slug
    if not skill_dir.is_dir():
        return None
    (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
    meta, _ = _parse_frontmatter(content)
    return {
        "name": slug,
        "description": meta.get("description"),
        "version": meta.get("version"),
        "author": meta.get("author"),
        "content": content,
        "path": str(skill_dir),
    }


async def delete_skill(name: str) -> bool:
    slug = _validate_name(name)
    skill_dir = _hermes_skills_dir() / slug
    if not skill_dir.is_dir():
        return False
    shutil.rmtree(skill_dir)
    return True
