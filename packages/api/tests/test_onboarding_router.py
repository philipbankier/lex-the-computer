"""Tests for the onboarding router."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers.onboarding import router
from app.services.onboarding_service import _sessions


@pytest.fixture
def onboarding_app(tmp_path):
    app = FastAPI()
    app.include_router(router)
    _sessions.clear()
    with patch("app.routers.onboarding.settings") as mock_settings:
        mock_settings.hermes_data_dir = str(tmp_path)
        yield app
    _sessions.clear()


class TestStartOnboarding:
    async def test_returns_session(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/onboarding/start")
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert data["current_step"] == 1


class TestOnboardingStatus:
    async def test_returns_status(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            resp = await client.get(f"/api/onboarding/status?session_id={sid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == sid
        assert "steps" in data

    async def test_unknown_session_404(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/onboarding/status?session_id=fake-id")
        assert resp.status_code == 404


class TestAccountStep:
    async def test_saves_account(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            resp = await client.post(
                f"/api/onboarding/account?session_id={sid}",
                json={"email": "user@test.com", "password": "pass123"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["current_step"] == 2

    async def test_single_user_mode(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            resp = await client.post(
                f"/api/onboarding/account?session_id={sid}",
                json={"single_user": True},
            )
        assert resp.status_code == 200


class TestProviderStep:
    async def test_saves_provider(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            resp = await client.post(
                f"/api/onboarding/provider?session_id={sid}",
                json={"provider": "anthropic", "model": "claude-sonnet-4-6", "api_key": "sk-123"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_step"] == 3


class TestMemoryStep:
    async def test_saves_memory(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            resp = await client.post(
                f"/api/onboarding/memory?session_id={sid}",
                json={"provider": "honcho"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_step"] == 4


class TestChannelsStep:
    async def test_saves_channels(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            resp = await client.post(
                f"/api/onboarding/channels?session_id={sid}",
                json={"telegram_bot_token": "bot:123", "telegram_user_id": 42},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_step"] == 5

    async def test_empty_channels(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            resp = await client.post(
                f"/api/onboarding/channels?session_id={sid}",
                json={},
            )
        assert resp.status_code == 200


class TestWorkspaceStep:
    async def test_saves_workspace(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]
            resp = await client.post(
                f"/api/onboarding/workspace?session_id={sid}",
                json={"workspace_dir": "/my/workspace"},
            )
        assert resp.status_code == 200


class TestCompleteOnboarding:
    async def test_complete_full_flow(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]

            await client.post(f"/api/onboarding/account?session_id={sid}", json={"email": "test@test.com"})
            await client.post(f"/api/onboarding/provider?session_id={sid}", json={"provider": "anthropic", "model": "claude-sonnet-4-6", "api_key": "sk-test"})
            await client.post(f"/api/onboarding/memory?session_id={sid}", json={"provider": "core"})
            await client.post(f"/api/onboarding/channels?session_id={sid}", json={})
            await client.post(f"/api/onboarding/workspace?session_id={sid}", json={"workspace_dir": "/data/ws"})

            resp = await client.post(f"/api/onboarding/complete?session_id={sid}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert "config_path" in data
        assert "hermes_config" in data

    async def test_complete_without_provider_fails(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            start = await client.post("/api/onboarding/start")
            sid = start.json()["session_id"]

            resp = await client.post(f"/api/onboarding/complete?session_id={sid}")

        assert resp.status_code == 400
        assert "provider" in resp.json()["detail"].lower()

    async def test_complete_unknown_session(self, onboarding_app):
        transport = ASGITransport(app=onboarding_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/onboarding/complete?session_id=nope")
        assert resp.status_code == 404
