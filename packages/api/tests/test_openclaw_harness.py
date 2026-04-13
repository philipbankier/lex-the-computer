"""Tests for the OpenClawHarness implementation."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.harness.base import HarnessConfig
from app.harness.openclaw import OpenClawHarness


@pytest.fixture
def harness() -> OpenClawHarness:
    config = HarnessConfig(gateway_url="ws://test:18789", gateway_token="oc-test-token")
    return OpenClawHarness(config)


class TestOpenClawSessions:
    async def test_create_and_list(self, harness):
        s = await harness.create_session("My Session")
        assert s.title == "My Session"
        sessions = await harness.list_sessions()
        assert len(sessions) == 1
        assert sessions[0].id == s.id

    async def test_get_session(self, harness):
        s = await harness.create_session("Find me")
        found = await harness.get_session(s.id)
        assert found is not None
        assert found.title == "Find me"

    async def test_get_session_not_found(self, harness):
        assert await harness.get_session("nonexistent") is None

    async def test_create_default_title(self, harness):
        s = await harness.create_session()
        assert s.title.startswith("Chat ")


class TestOpenClawAutomations:
    async def test_list_automations_empty(self, harness):
        with patch.object(harness, "_run_cli", return_value="[]"):
            automations = await harness.list_automations()
            assert automations == []

    async def test_list_automations_with_jobs(self, harness):
        jobs = [{"id": "abc", "name": "test", "message": "go", "cron": "0 9 * * *", "agent": "dev"}]
        with patch.object(harness, "_run_cli", return_value=json.dumps(jobs)):
            automations = await harness.list_automations()
            assert len(automations) == 1
            assert automations[0].name == "test"
            assert automations[0].delivery == "dev"

    async def test_list_automations_handles_error(self, harness):
        with patch.object(harness, "_run_cli", side_effect=Exception("CLI error")):
            automations = await harness.list_automations()
            assert automations == []

    async def test_create_automation(self, harness):
        with patch.object(harness, "_run_cli", return_value=""):
            a = await harness.create_automation(
                name="Report", instruction="Do stuff", schedule="0 8 * * *", delivery="telegram",
            )
            assert a.name == "Report"
            assert a.enabled is True

    async def test_delete_automation(self, harness):
        with patch.object(harness, "_run_cli", return_value=""):
            assert await harness.delete_automation("some-id") is True

    async def test_delete_automation_error(self, harness):
        with patch.object(harness, "_run_cli", side_effect=Exception("fail")):
            assert await harness.delete_automation("bad-id") is False

    async def test_update_calls_delete_then_create(self, harness):
        calls = []
        def fake_cli(args):
            calls.append(args)
            return ""
        with patch.object(harness, "_run_cli", side_effect=fake_cli):
            await harness.update_automation(
                "old-id", name="New", instruction="Do", schedule="0 0 * * *", delivery="discord",
            )
            assert any("rm" in c for c in calls)


class TestOpenClawSkills:
    async def test_list_skills_empty(self, harness):
        assert await harness.list_skills() == []


class TestOpenClawHealth:
    async def test_health_ok(self, harness):
        fake_ws = AsyncMock()
        with patch.object(harness, "_connect", return_value=fake_ws):
            result = await harness.health_check()
            assert result["status"] == "ok"
            assert result["gateway"] == "connected"

    async def test_health_degraded(self, harness):
        with patch.object(harness, "_connect", side_effect=ConnectionError("refused")):
            result = await harness.health_check()
            assert result["status"] == "degraded"
            assert "error" in result["gateway"]


class TestOpenClawSendMessage:
    async def test_streams_agent_events(self, harness):
        all_messages = [
            json.dumps({"type": "hello-ok"}),
            json.dumps({"event": "agent", "payload": "Hello "}),
            json.dumps({"event": "agent", "payload": "world"}),
            json.dumps({"type": "res", "id": "test-id"}),
        ]

        class FakeWebSocket:
            def __init__(self):
                self._messages = list(all_messages)
                self._index = 0

            async def send(self, data):
                pass

            async def close(self):
                pass

            def __aiter__(self):
                return self

            async def __anext__(self):
                if self._index >= len(self._messages):
                    raise StopAsyncIteration
                msg = self._messages[self._index]
                self._index += 1
                return msg

        fake_ws = FakeWebSocket()

        async def mock_connect(url):
            return fake_ws

        with patch("app.harness.openclaw.websockets.connect", new=mock_connect), \
             patch("app.harness.openclaw.uuid.uuid4", return_value="test-id"):
            chunks = []
            async for chunk in harness.send_message("session-1", "Hi"):
                chunks.append(chunk)

        assert chunks[0].event == "start"
        assert chunks[1].event == "token"
        assert chunks[1].data == "Hello "
        assert chunks[2].event == "token"
        assert chunks[2].data == "world"
        assert chunks[3].event == "end"
