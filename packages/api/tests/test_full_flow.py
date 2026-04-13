"""Integration test — full flow: health → onboarding → chat → skill → automation."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import automations as automations_router_mod
from app.routers import chat as chat_module
from app.routers.automations import router as automations_router
from app.routers.chat import router as chat_router
from app.routers.health import router as health_router
from app.routers.onboarding import router as onboarding_router
from app.routers.skills import router as skills_router
from app.services import automations_service
from app.services.onboarding_service import _sessions


@pytest.fixture
def integration_app(mock_harness, tmp_path):
    app = FastAPI()
    app.include_router(health_router)
    app.include_router(chat_router)
    app.include_router(onboarding_router)
    app.include_router(skills_router)
    app.include_router(automations_router)

    # Override DB dependency
    from app.database import get_db
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()

    async def fake_db():
        yield mock_session

    app.dependency_overrides[get_db] = fake_db

    # Override auth
    from app.middleware.auth import get_current_user
    fake_user = MagicMock()
    fake_user.id = 1
    app.dependency_overrides[get_current_user] = lambda: fake_user

    # Inject mock harness
    original_chat = chat_module._harness
    original_auto = automations_service._harness
    chat_module._harness = mock_harness
    automations_service._harness = mock_harness

    _sessions.clear()

    with patch("app.routers.health.get_harness", return_value=mock_harness), \
         patch("app.services.skills_service.settings") as skill_settings, \
         patch("app.routers.onboarding.settings") as onb_settings:
        skill_settings.hermes_data_dir = str(tmp_path)
        onb_settings.hermes_data_dir = str(tmp_path)
        (tmp_path / "skills").mkdir()
        yield app

    chat_module._harness = original_chat
    automations_service._harness = original_auto
    _sessions.clear()


class TestFullFlow:
    async def test_health_check(self, integration_app):
        transport = ASGITransport(app=integration_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "2.0.0"

    async def test_onboarding_then_chat(self, integration_app):
        transport = ASGITransport(app=integration_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Start onboarding
            resp = await client.post("/api/onboarding/start")
            assert resp.status_code == 200
            sid = resp.json()["session_id"]

            # 2. Walk through wizard
            await client.post(f"/api/onboarding/account?session_id={sid}", json={"email": "test@test.com"})
            await client.post(f"/api/onboarding/provider?session_id={sid}", json={"provider": "anthropic", "model": "claude-sonnet-4-6", "api_key": "sk-test"})
            await client.post(f"/api/onboarding/memory?session_id={sid}", json={"provider": "core"})
            await client.post(f"/api/onboarding/channels?session_id={sid}", json={})
            await client.post(f"/api/onboarding/workspace?session_id={sid}", json={"workspace_dir": "/data/ws"})

            resp = await client.post(f"/api/onboarding/complete?session_id={sid}")
            assert resp.status_code == 200
            assert resp.json()["ok"] is True

            # 3. Chat
            resp = await client.post("/api/chat", json={"message": "Hello after onboarding!"})
            assert resp.status_code == 200
            assert "event: start" in resp.text
            assert "event: end" in resp.text

    async def test_skill_crud(self, integration_app):
        transport = ASGITransport(app=integration_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Create
            resp = await client.post("/api/skills/", json={"name": "test-skill", "description": "Integration test"})
            assert resp.status_code == 200

            # List
            resp = await client.get("/api/skills/")
            assert resp.status_code == 200
            assert len(resp.json()) == 1

            # Get
            resp = await client.get("/api/skills/test-skill")
            assert resp.status_code == 200
            assert resp.json()["name"] == "test-skill"

            # Update
            resp = await client.put("/api/skills/test-skill", json={"content": "---\nname: test-skill\ndescription: Updated\n---\nNew body"})
            assert resp.status_code == 200
            assert resp.json()["description"] == "Updated"

            # Delete
            resp = await client.delete("/api/skills/test-skill")
            assert resp.status_code == 200

            # Verify deleted
            resp = await client.get("/api/skills/test-skill")
            assert resp.status_code == 404

    async def test_automation_crud_and_toggle(self, integration_app):
        transport = ASGITransport(app=integration_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Create
            resp = await client.post("/api/automations", json={
                "name": "Daily Status",
                "instruction": "Send status report",
                "schedule": "0 8 * * *",
                "delivery": "telegram",
            })
            assert resp.status_code == 200
            aid = resp.json()["id"]

            # List
            resp = await client.get("/api/automations")
            assert len(resp.json()) == 1

            # Update
            resp = await client.patch(f"/api/automations/{aid}", json={"name": "Updated Status"})
            assert resp.status_code == 200
            assert resp.json()["name"] == "Updated Status"

            # Toggle
            resp = await client.post(f"/api/automations/{aid}/toggle")
            assert resp.status_code == 200
            assert resp.json()["enabled"] is False

            # Toggle back
            resp = await client.post(f"/api/automations/{aid}/toggle")
            assert resp.json()["enabled"] is True

            # Delete
            resp = await client.delete(f"/api/automations/{aid}")
            assert resp.status_code == 200
            assert resp.json()["deleted"] is True

    async def test_complete_integration_flow(self, integration_app):
        """Full golden path: health → onboard → chat → create skill → create automation."""
        transport = ASGITransport(app=integration_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Health
            resp = await client.get("/health")
            assert resp.json()["status"] == "ok"

            # Onboard
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            await client.post(f"/api/onboarding/provider?session_id={sid}", json={"provider": "anthropic", "model": "claude-sonnet-4-6"})
            await client.post(f"/api/onboarding/memory?session_id={sid}", json={"provider": "core"})
            complete = await client.post(f"/api/onboarding/complete?session_id={sid}")
            assert complete.json()["ok"] is True

            # Chat
            chat = await client.post("/api/chat", json={"message": "First message!"})
            assert chat.status_code == 200

            # Create skill
            skill = await client.post("/api/skills/", json={"name": "my-skill", "description": "Test"})
            assert skill.status_code == 200

            # Create automation
            auto = await client.post("/api/automations", json={
                "name": "Auto", "instruction": "Do", "schedule": "0 0 * * *", "delivery": "discord",
            })
            assert auto.status_code == 200

            # Verify everything
            assert len((await client.get("/api/skills/")).json()) == 1
            assert len((await client.get("/api/automations")).json()) == 1
