"""Tests for the health router."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers.health import router


def _make_app(db_ok: bool = True, harness_health: dict | None = None) -> FastAPI:
    app = FastAPI()
    app.include_router(router)

    async def mock_get_db():
        session = AsyncMock()
        if db_ok:
            session.execute = AsyncMock()
        else:
            session.execute = AsyncMock(side_effect=Exception("DB down"))
        yield session

    app.dependency_overrides["app.database.get_db"] = mock_get_db

    hh = harness_health or {"status": "ok", "gateway": "connected"}

    mock_harness = AsyncMock()
    mock_harness.health_check = AsyncMock(return_value=hh)

    return app, mock_harness


class TestHealthEndpoint:
    async def test_healthy_response(self):
        app, mock_h = _make_app()
        with patch("app.routers.health.get_harness", return_value=mock_h), \
             patch("app.routers.health.get_db") as mock_db_dep:
            mock_session = AsyncMock()
            mock_session.execute = AsyncMock()

            async def fake_db():
                yield mock_session

            mock_db_dep.side_effect = fake_db
            app.dependency_overrides[mock_db_dep] = fake_db

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Override the dependency directly
                from app.database import get_db
                app.dependency_overrides[get_db] = fake_db

                resp = await client.get("/health")

            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ok"
            assert data["version"] == "2.0.0"
            assert data["database"] == "ok"
            assert data["harness"]["status"] == "ok"

    async def test_degraded_when_harness_down(self):
        app = FastAPI()
        app.include_router(router)

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()

        async def fake_db():
            yield mock_session

        from app.database import get_db
        app.dependency_overrides[get_db] = fake_db

        mock_h = AsyncMock()
        mock_h.health_check = AsyncMock(return_value={"status": "degraded", "gateway": "error"})

        with patch("app.routers.health.get_harness", return_value=mock_h):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/health")

            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "degraded"

    async def test_degraded_when_db_down(self):
        app = FastAPI()
        app.include_router(router)

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(side_effect=Exception("Connection refused"))

        async def fake_db():
            yield mock_session

        from app.database import get_db
        app.dependency_overrides[get_db] = fake_db

        mock_h = AsyncMock()
        mock_h.health_check = AsyncMock(return_value={"status": "ok", "gateway": "connected"})

        with patch("app.routers.health.get_harness", return_value=mock_h):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/health")

            data = resp.json()
            assert data["status"] == "degraded"
            assert "error" in data["database"]

    async def test_harness_init_failure(self):
        app = FastAPI()
        app.include_router(router)

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()

        async def fake_db():
            yield mock_session

        from app.database import get_db
        app.dependency_overrides[get_db] = fake_db

        with patch("app.routers.health.get_harness", side_effect=ValueError("bad config")):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/health")

            data = resp.json()
            assert data["status"] == "degraded"
            assert data["harness"]["status"] == "down"
