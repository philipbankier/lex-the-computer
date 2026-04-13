"""Tests for the HermesHarness implementation."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from app.harness.base import HarnessConfig
from app.harness.hermes import HermesHarness


@pytest.fixture
def harness(tmp_path) -> HermesHarness:
    config = HarnessConfig(
        gateway_url="http://hermes-test:8642",
        gateway_token="test-api-key",
        extra={"data_dir": str(tmp_path)},
    )
    return HermesHarness(config)


class TestHermesInit:
    def test_base_url_strips_trailing_slash(self):
        config = HarnessConfig(gateway_url="http://host:8642/", gateway_token="key")
        h = HermesHarness(config)
        assert h._base_url == "http://host:8642"

    def test_data_dir_defaults(self):
        config = HarnessConfig(gateway_url="http://host:8642", gateway_token="key")
        h = HermesHarness(config)
        assert h._data_dir == Path("/data/hermes")

    def test_headers_with_api_key(self, harness):
        headers = harness._headers()
        assert headers["Authorization"] == "Bearer test-api-key"
        assert headers["Content-Type"] == "application/json"

    def test_headers_without_api_key(self):
        config = HarnessConfig(gateway_url="http://host:8642", gateway_token="")
        h = HermesHarness(config)
        headers = h._headers()
        assert "Authorization" not in headers


class TestHermesSendMessage:
    async def test_streams_chunks(self, harness, monkeypatch):
        sse_lines = [
            'data: {"type":"response.output_text.delta","delta":"Hello "}',
            'data: {"type":"response.output_text.delta","delta":"world"}',
            "data: [DONE]",
        ]

        class FakeResponse:
            status_code = 200
            def raise_for_status(self):
                pass
            async def aiter_lines(self):
                for line in sse_lines:
                    yield line
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass

        class FakeClient:
            def __init__(self, **kw):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            def stream(self, method, url, **kw):
                return FakeResponse()

        monkeypatch.setattr("app.harness.hermes.httpx.AsyncClient", FakeClient)

        chunks = []
        async for chunk in harness.send_message("session-1", "Hi"):
            chunks.append(chunk)

        assert chunks[0].event == "start"
        assert chunks[0].data == {"model": "hermes"}
        assert chunks[1].event == "token"
        assert chunks[1].data == "Hello "
        assert chunks[2].event == "token"
        assert chunks[2].data == "world"
        assert chunks[3].event == "end"

    async def test_skips_non_data_lines(self, harness, monkeypatch):
        sse_lines = [
            ": comment",
            "",
            'data: {"type":"response.output_text.delta","delta":"ok"}',
            "data: [DONE]",
        ]

        class FakeResponse:
            status_code = 200
            def raise_for_status(self):
                pass
            async def aiter_lines(self):
                for line in sse_lines:
                    yield line
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass

        class FakeClient:
            def __init__(self, **kw):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            def stream(self, method, url, **kw):
                return FakeResponse()

        monkeypatch.setattr("app.harness.hermes.httpx.AsyncClient", FakeClient)

        tokens = [c async for c in harness.send_message("s1", "yo") if c.event == "token"]
        assert len(tokens) == 1
        assert tokens[0].data == "ok"


class TestHermesSessions:
    async def test_list_sessions_returns_empty(self, harness):
        assert await harness.list_sessions() == []

    async def test_get_session_returns_none(self, harness):
        assert await harness.get_session("nonexistent") is None

    async def test_create_session_with_title(self, harness):
        s = await harness.create_session("My Chat")
        assert s.title == "My Chat"
        assert s.id  # UUID string

    async def test_create_session_default_title(self, harness):
        s = await harness.create_session()
        assert s.title.startswith("Chat ")


class TestHermesAutomations:
    async def test_create_and_list(self, harness):
        a = await harness.create_automation(
            name="Daily report", instruction="Send status", schedule="0 8 * * *", delivery="telegram",
        )
        assert a.name == "Daily report"
        assert a.enabled is True

        automations = await harness.list_automations()
        assert len(automations) == 1
        assert automations[0].name == "Daily report"

    async def test_update_automation(self, harness):
        a = await harness.create_automation(
            name="Test", instruction="Go", schedule="0 9 * * *", delivery="discord",
        )
        updated = await harness.update_automation(a.id, name="Updated", enabled=False)
        assert updated.name == "Updated"
        assert updated.enabled is False

    async def test_update_nonexistent_raises(self, harness):
        with pytest.raises(ValueError, match="not found"):
            await harness.update_automation("fake-id", name="nope")

    async def test_delete_automation(self, harness):
        a = await harness.create_automation(
            name="ToDelete", instruction="x", schedule="* * * * *", delivery="email",
        )
        assert await harness.delete_automation(a.id) is True
        assert await harness.list_automations() == []

    async def test_delete_nonexistent_returns_false(self, harness):
        assert await harness.delete_automation("nonexistent") is False

    async def test_cron_file_persists(self, harness, tmp_path):
        await harness.create_automation(
            name="Persist", instruction="test", schedule="0 0 * * *", delivery="telegram",
        )
        cron_file = tmp_path / "cron" / "jobs.json"
        assert cron_file.exists()
        jobs = json.loads(cron_file.read_text())
        assert len(jobs) == 1
        assert jobs[0]["name"] == "Persist"


class TestHermesSkills:
    async def test_list_skills_empty(self, harness, tmp_path):
        assert await harness.list_skills() == []

    async def test_list_skills_with_dirs(self, harness, tmp_path):
        (tmp_path / "skills" / "my-skill").mkdir(parents=True)
        skills = await harness.list_skills()
        assert len(skills) == 1
        assert skills[0].name == "my-skill"


class TestHermesHealth:
    async def test_health_ok(self, harness, monkeypatch):
        class FakeResponse:
            status_code = 200
            def raise_for_status(self):
                pass

        class FakeClient:
            def __init__(self, **kw):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def get(self, url, **kw):
                return FakeResponse()

        monkeypatch.setattr("app.harness.hermes.httpx.AsyncClient", FakeClient)
        result = await harness.health_check()
        assert result["status"] == "ok"
        assert result["gateway"] == "connected"

    async def test_health_degraded_on_error(self, harness, monkeypatch):
        class FakeClient:
            def __init__(self, **kw):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def get(self, url, **kw):
                raise ConnectionError("refused")

        monkeypatch.setattr("app.harness.hermes.httpx.AsyncClient", FakeClient)
        result = await harness.health_check()
        assert result["status"] == "degraded"
        assert "error" in result["gateway"]
