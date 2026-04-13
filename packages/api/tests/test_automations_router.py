"""Tests for the automations router."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers.automations import router
from app.services import automations_service


@pytest.fixture
def automations_app(mock_harness):
    app = FastAPI()
    app.include_router(router)
    original = automations_service._harness
    automations_service._harness = mock_harness
    yield app
    automations_service._harness = original


class TestListAutomations:
    async def test_empty_list(self, automations_app):
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/automations")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_with_automations(self, automations_app, mock_harness):
        await mock_harness.create_automation(
            name="Daily", instruction="Report", schedule="0 8 * * *", delivery="telegram",
        )
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/automations")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Daily"


class TestCreateAutomation:
    async def test_creates_automation(self, automations_app):
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/automations",
                json={
                    "name": "Nightly",
                    "instruction": "Run backup",
                    "schedule": "0 0 * * *",
                    "delivery": "discord",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Nightly"
        assert data["delivery"] == "discord"
        assert data["enabled"] is True
        assert "id" in data


class TestUpdateAutomation:
    async def test_updates_automation(self, automations_app, mock_harness):
        a = await mock_harness.create_automation(
            name="Old", instruction="x", schedule="* * * * *", delivery="email",
        )
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.patch(
                f"/api/automations/{a.id}",
                json={"name": "Updated"},
            )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated"

    async def test_update_nonexistent_404(self, automations_app):
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.patch(
                "/api/automations/fake-id",
                json={"name": "Nope"},
            )
        assert resp.status_code == 404


class TestDeleteAutomation:
    async def test_deletes_automation(self, automations_app, mock_harness):
        a = await mock_harness.create_automation(
            name="ToDelete", instruction="x", schedule="* * * * *", delivery="email",
        )
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.delete(f"/api/automations/{a.id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    async def test_delete_nonexistent_404(self, automations_app):
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.delete("/api/automations/fake-id")
        assert resp.status_code == 404


class TestToggleAutomation:
    async def test_toggles_enabled(self, automations_app, mock_harness):
        a = await mock_harness.create_automation(
            name="Toggle", instruction="x", schedule="0 0 * * *", delivery="telegram",
        )
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"/api/automations/{a.id}/toggle")
        assert resp.status_code == 200
        assert resp.json()["enabled"] is False

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(f"/api/automations/{a.id}/toggle")
        assert resp.json()["enabled"] is True

    async def test_toggle_nonexistent_404(self, automations_app):
        transport = ASGITransport(app=automations_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/automations/fake-id/toggle")
        assert resp.status_code == 404
