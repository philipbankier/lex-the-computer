"""Tests for the session search service (SQLite-backed)."""

from __future__ import annotations

from unittest.mock import patch

import aiosqlite
import pytest

from app.services.session_search_service import (
    _find_fts_tables,
    _safe_identifier,
    _search_fallback,
    search_sessions,
)


@pytest.fixture
def mock_state_db(tmp_path):
    db_path = tmp_path / "state.db"
    with patch("app.services.session_search_service.settings") as mock_settings:
        mock_settings.hermes_data_dir = str(tmp_path)
        yield db_path


class TestSafeIdentifier:
    def test_valid_identifier(self):
        assert _safe_identifier("messages") == "messages"

    def test_valid_with_underscore(self):
        assert _safe_identifier("my_table") == "my_table"

    def test_rejects_sql_injection(self):
        with pytest.raises(ValueError, match="Unsafe identifier"):
            _safe_identifier("table; DROP TABLE users--")

    def test_rejects_spaces(self):
        with pytest.raises(ValueError, match="Unsafe identifier"):
            _safe_identifier("my table")

    def test_rejects_starting_with_number(self):
        with pytest.raises(ValueError, match="Unsafe identifier"):
            _safe_identifier("123table")


class TestSearchSessions:
    async def test_returns_empty_when_no_db(self, mock_state_db):
        result = await search_sessions("hello")
        assert result == []

    async def test_fallback_search(self, mock_state_db):
        async with aiosqlite.connect(str(mock_state_db)) as db:
            await db.execute(
                "CREATE TABLE messages (id INTEGER PRIMARY KEY, content TEXT, created_at TEXT)"
            )
            await db.execute(
                "INSERT INTO messages (content, created_at) VALUES (?, ?)",
                ("Hello world from Hermes", "2026-01-01"),
            )
            await db.execute(
                "INSERT INTO messages (content, created_at) VALUES (?, ?)",
                ("Goodbye world", "2026-01-02"),
            )
            await db.commit()

        result = await search_sessions("Hello")
        assert len(result) == 1
        assert "Hello" in result[0]["content"]

    async def test_fallback_no_match(self, mock_state_db):
        async with aiosqlite.connect(str(mock_state_db)) as db:
            await db.execute(
                "CREATE TABLE messages (id INTEGER PRIMARY KEY, content TEXT)"
            )
            await db.execute(
                "INSERT INTO messages (content) VALUES (?)", ("No match here",)
            )
            await db.commit()

        result = await search_sessions("nonexistent-query-xyz")
        assert result == []

    async def test_limit_parameter(self, mock_state_db):
        async with aiosqlite.connect(str(mock_state_db)) as db:
            await db.execute(
                "CREATE TABLE messages (id INTEGER PRIMARY KEY, content TEXT)"
            )
            for i in range(10):
                await db.execute(
                    "INSERT INTO messages (content) VALUES (?)", (f"Message {i}",)
                )
            await db.commit()

        result = await search_sessions("Message", limit=3)
        assert len(result) == 3

    async def test_handles_db_error(self, mock_state_db):
        mock_state_db.write_text("not a database")
        result = await search_sessions("test")
        assert result == []


class TestFindFtsTables:
    async def test_no_fts_tables(self, tmp_path):
        db_path = tmp_path / "test.db"
        async with aiosqlite.connect(str(db_path)) as db:
            await db.execute("CREATE TABLE regular (id INTEGER PRIMARY KEY)")
            tables = await _find_fts_tables(db)
            assert tables == []

    async def test_finds_fts_table(self, tmp_path):
        db_path = tmp_path / "test.db"
        async with aiosqlite.connect(str(db_path)) as db:
            await db.execute(
                "CREATE VIRTUAL TABLE messages_fts USING fts5(content, title)"
            )
            tables = await _find_fts_tables(db)
            assert "messages_fts" in tables


class TestSearchFallback:
    async def test_tries_known_table_names(self, tmp_path):
        db_path = tmp_path / "test.db"
        async with aiosqlite.connect(str(db_path)) as db:
            await db.execute("CREATE TABLE conversations (id INTEGER PRIMARY KEY, title TEXT)")
            await db.execute("INSERT INTO conversations (title) VALUES (?)", ("My Chat",))
            await db.commit()

            db.row_factory = aiosqlite.Row
            result = await _search_fallback(db, "Chat", 10)
            assert len(result) == 1

    async def test_returns_empty_no_matching_tables(self, tmp_path):
        db_path = tmp_path / "test.db"
        async with aiosqlite.connect(str(db_path)) as db:
            await db.execute("CREATE TABLE unrelated (id INTEGER PRIMARY KEY, data BLOB)")
            await db.commit()

            db.row_factory = aiosqlite.Row
            result = await _search_fallback(db, "test", 10)
            assert result == []
