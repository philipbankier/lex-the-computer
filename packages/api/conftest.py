"""Root conftest — shared fixtures for all API tests."""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.harness.base import (
    AgentHarness,
    Automation,
    HarnessConfig,
    Session,
    Skill,
    StreamChunk,
)


class MockHarness(AgentHarness):
    """In-memory harness for testing."""

    def __init__(self) -> None:
        super().__init__(HarnessConfig(gateway_url="http://test:8642", gateway_token="test-key"))
        self._sessions: dict[str, Session] = {}
        self._automations: dict[str, Automation] = {}

    async def send_message(
        self, session_id: str, message: str, attachments: list[dict[str, Any]] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        yield StreamChunk(event="start", data={"model": "test"})
        yield StreamChunk(event="token", data="Hello ")
        yield StreamChunk(event="token", data="world")
        yield StreamChunk(event="end", data={"messageId": 1})

    async def list_sessions(self) -> list[Session]:
        return list(self._sessions.values())

    async def get_session(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    async def create_session(self, title: str | None = None) -> Session:
        sid = str(uuid.uuid4())
        now = datetime.now(tz=timezone.utc)
        s = Session(id=sid, title=title or "Test Chat", created_at=now, updated_at=now)
        self._sessions[sid] = s
        return s

    async def list_automations(self) -> list[Automation]:
        return list(self._automations.values())

    async def create_automation(
        self, name: str, instruction: str, schedule: str, delivery: str,
    ) -> Automation:
        aid = str(uuid.uuid4())
        now = datetime.now(tz=timezone.utc)
        a = Automation(
            id=aid, name=name, instruction=instruction, schedule=schedule,
            delivery=delivery, enabled=True, created_at=now, updated_at=now,
        )
        self._automations[aid] = a
        return a

    async def update_automation(self, automation_id: str, **kwargs: Any) -> Automation:
        a = self._automations.get(automation_id)
        if not a:
            raise ValueError(f"Automation {automation_id} not found")
        for k, v in kwargs.items():
            if hasattr(a, k):
                setattr(a, k, v)
        return a

    async def delete_automation(self, automation_id: str) -> bool:
        return self._automations.pop(automation_id, None) is not None

    async def list_skills(self) -> list[Skill]:
        return [Skill(name="test-skill", description="A test skill")]

    async def start_gateway(self) -> None:
        pass

    async def stop_gateway(self) -> None:
        pass

    async def health_check(self) -> dict[str, Any]:
        return {"status": "ok", "gateway": "connected"}


@pytest.fixture
def mock_harness() -> MockHarness:
    return MockHarness()


@pytest.fixture
def temp_workspace(tmp_path):
    return tmp_path
