"""Tests for the skills router (Hermes CRUD endpoints)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers.skills import router


@pytest.fixture
def skills_app(tmp_path):
    app = FastAPI()
    app.include_router(router)

    fake_user = MagicMock()
    fake_user.id = 1

    from app.middleware.auth import get_current_user
    from app.database import get_db

    app.dependency_overrides[get_current_user] = lambda: fake_user

    async def fake_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = fake_db

    with patch("app.services.skills_service.settings") as mock_settings:
        mock_settings.hermes_data_dir = str(tmp_path)
        skills_dir = tmp_path / "skills"
        skills_dir.mkdir()
        yield app, skills_dir


class TestListSkills:
    async def test_empty_list(self, skills_app):
        app, _ = skills_app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/skills/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_with_skills(self, skills_app):
        app, skills_dir = skills_app
        skill_dir = skills_dir / "my-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: my-skill\ndescription: Test\n---\n# My Skill\n")

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/skills/")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "my-skill"


class TestCreateSkill:
    async def test_creates_skill(self, skills_app):
        app, skills_dir = skills_app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/skills/",
                json={"name": "new-skill", "description": "Fresh skill", "author": "Test"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "new-skill"
        assert (skills_dir / "new-skill" / "SKILL.md").exists()

    async def test_empty_name_400(self, skills_app):
        app, _ = skills_app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/skills/", json={"name": ""})
        assert resp.status_code == 400

    async def test_duplicate_409(self, skills_app):
        app, _ = skills_app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post("/api/skills/", json={"name": "dup-skill"})
            resp = await client.post("/api/skills/", json={"name": "dup-skill"})
        assert resp.status_code == 409


class TestGetSkill:
    async def test_get_existing(self, skills_app):
        app, skills_dir = skills_app
        skill_dir = skills_dir / "my-skill"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: my-skill\ndescription: A skill\n---\n# Content\n")

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/skills/my-skill")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "my-skill"
        assert data["description"] == "A skill"

    async def test_get_nonexistent_404(self, skills_app):
        app, _ = skills_app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/skills/nonexistent")
        assert resp.status_code == 404


class TestUpdateSkill:
    async def test_updates_content(self, skills_app):
        app, skills_dir = skills_app
        skill_dir = skills_dir / "editable"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: editable\n---\nOld content")

        transport = ASGITransport(app=app)
        new_content = "---\nname: editable\ndescription: Updated\n---\nNew content"
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.put(
                "/api/skills/editable",
                json={"content": new_content},
            )
        assert resp.status_code == 200
        assert resp.json()["description"] == "Updated"

    async def test_update_nonexistent_404(self, skills_app):
        app, _ = skills_app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.put(
                "/api/skills/ghost",
                json={"content": "new stuff"},
            )
        assert resp.status_code == 404


class TestDeleteSkill:
    async def test_deletes_existing(self, skills_app):
        app, skills_dir = skills_app
        skill_dir = skills_dir / "deletable"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text("---\nname: deletable\n---\ncontent")

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.delete("/api/skills/deletable")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert not skill_dir.exists()

    async def test_delete_nonexistent_404(self, skills_app):
        app, _ = skills_app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.delete("/api/skills/ghost")
        assert resp.status_code == 404
