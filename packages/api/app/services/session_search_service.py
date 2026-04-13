"""Session search service — queries Hermes state.db (SQLite + FTS5).

Hermes stores conversation history in ``{hermes_data_dir}/state.db``.
This service reads it directly via the shared Docker volume.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import aiosqlite

from app.config import settings

logger = logging.getLogger(__name__)


def _state_db_path() -> Path:
    return Path(settings.hermes_data_dir) / "state.db"


def _safe_identifier(name: str) -> str:
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", name):
        raise ValueError(f"Unsafe identifier: {name!r}")
    return name


async def search_sessions(query: str, limit: int = 20) -> list[dict[str, Any]]:
    db_path = _state_db_path()
    if not db_path.exists():
        return []

    try:
        async with aiosqlite.connect(str(db_path)) as db:
            db.row_factory = aiosqlite.Row

            fts_tables = await _find_fts_tables(db)
            if fts_tables:
                return await _search_fts(db, fts_tables[0], query, limit)

            return await _search_fallback(db, query, limit)
    except Exception:
        logger.exception("Failed to search Hermes state.db")
        return []


async def _find_fts_tables(db: aiosqlite.Connection) -> list[str]:
    cursor = await db.execute(
        "SELECT name FROM sqlite_master "
        "WHERE type = 'table' AND sql LIKE '%fts5%'"
    )
    return [row[0] for row in await cursor.fetchall()]


async def _search_fts(
    db: aiosqlite.Connection,
    table: str,
    query: str,
    limit: int,
) -> list[dict[str, Any]]:
    table = _safe_identifier(table)
    cursor = await db.execute(
        f"SELECT *, snippet({table}, -1, '<mark>', '</mark>', '\u2026', 48) AS snippet "
        f"FROM {table} WHERE {table} MATCH ? ORDER BY rank LIMIT ?",
        (query, limit),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def _search_fallback(
    db: aiosqlite.Connection,
    query: str,
    limit: int,
) -> list[dict[str, Any]]:
    cursor = await db.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    )
    tables = [row[0] for row in await cursor.fetchall()]

    for candidate in ("messages", "conversations", "sessions"):
        if candidate not in tables:
            continue
        try:
            table = _safe_identifier(candidate)
            col_cursor = await db.execute(f"PRAGMA table_info({table})")
            columns = [row[1] for row in await col_cursor.fetchall()]

            text_col = next(
                (c for c in ("content", "text", "body", "message", "title", "summary")
                 if c in columns),
                None,
            )
            if not text_col:
                continue

            text_col = _safe_identifier(text_col)
            cursor = await db.execute(
                f"SELECT * FROM {table} WHERE {text_col} LIKE ? LIMIT ?",
                (f"%{query}%", limit),
            )
            rows = await cursor.fetchall()
            if rows:
                return [dict(row) for row in rows]
        except Exception:
            continue

    return []
