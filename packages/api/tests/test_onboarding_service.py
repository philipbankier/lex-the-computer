"""Tests for the onboarding service."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services import onboarding_service
from app.services.onboarding_service import (
    OnboardingSession,
    STEP_NAMES,
    _sessions,
    complete_onboarding,
    get_session,
    save_account,
    save_channels,
    save_memory,
    save_provider,
    save_workspace,
    start_session,
)


@pytest.fixture(autouse=True)
def clear_sessions():
    _sessions.clear()
    yield
    _sessions.clear()


class TestOnboardingSession:
    def test_step_status_initial(self):
        s = OnboardingSession(session_id="test")
        status = s.step_status()
        assert status["account"] is False
        assert status["provider"] is False
        assert status["memory"] is False
        assert status["channels"] is True  # always true (optional)
        assert status["workspace"] is False

    def test_to_status(self):
        s = OnboardingSession(session_id="test-id", current_step=2)
        status = s.to_status()
        assert status["session_id"] == "test-id"
        assert status["current_step"] == 2
        assert status["completed"] is False
        assert "steps" in status


class TestStartSession:
    def test_creates_session(self):
        s = start_session()
        assert s.session_id
        assert s.current_step == 1
        assert s.completed is False

    def test_session_stored(self):
        s = start_session()
        assert get_session(s.session_id) is s


class TestGetSession:
    def test_returns_none_for_unknown(self):
        assert get_session("nonexistent") is None


class TestSaveAccount:
    def test_saves_account_data(self):
        s = start_session()
        result = save_account(s.session_id, email="user@test.com", password="pass123")
        assert result.account["email"] == "user@test.com"
        assert result.account["password"] == "pass123"
        assert result.account["single_user"] is False

    def test_advances_step(self):
        s = start_session()
        result = save_account(s.session_id, email="test@test.com")
        assert result.current_step == 2

    def test_single_user_mode(self):
        s = start_session()
        result = save_account(s.session_id, single_user=True)
        assert result.account["single_user"] is True

    def test_does_not_regress_step(self):
        s = start_session()
        save_provider(s.session_id, provider="anthropic", model="claude-sonnet-4-6")
        result = save_account(s.session_id, email="test@test.com")
        assert result.current_step == 3  # stays at 3, not back to 2


class TestSaveProvider:
    def test_saves_provider_data(self):
        s = start_session()
        result = save_provider(s.session_id, provider="anthropic", model="claude-sonnet-4-6", api_key="sk-123")
        assert result.provider["provider"] == "anthropic"
        assert result.provider["model"] == "claude-sonnet-4-6"
        assert result.provider["api_key"] == "sk-123"

    def test_advances_step(self):
        s = start_session()
        result = save_provider(s.session_id, provider="openai", model="gpt-4")
        assert result.current_step == 3


class TestSaveMemory:
    def test_saves_memory_provider(self):
        s = start_session()
        result = save_memory(s.session_id, provider="honcho")
        assert result.memory["provider"] == "honcho"

    def test_advances_step(self):
        s = start_session()
        result = save_memory(s.session_id, provider="core")
        assert result.current_step == 4


class TestSaveChannels:
    def test_saves_channel_data(self):
        s = start_session()
        result = save_channels(
            s.session_id,
            telegram_bot_token="bot:123",
            telegram_user_id=12345,
            discord_bot_token="disc-token",
        )
        assert result.channels["telegram_bot_token"] == "bot:123"
        assert result.channels["telegram_user_id"] == 12345
        assert result.channels["discord_bot_token"] == "disc-token"

    def test_advances_step(self):
        s = start_session()
        result = save_channels(s.session_id)
        assert result.current_step == 5


class TestSaveWorkspace:
    def test_saves_workspace_dir(self):
        s = start_session()
        result = save_workspace(s.session_id, workspace_dir="/my/workspace")
        assert result.workspace["workspace_dir"] == "/my/workspace"


class TestCompleteOnboarding:
    def test_generates_config(self, tmp_path):
        s = start_session()
        save_account(s.session_id, email="test@test.com")
        save_provider(s.session_id, provider="anthropic", model="claude-sonnet-4-6", api_key="sk-test")
        save_memory(s.session_id, provider="core")
        save_channels(s.session_id, telegram_bot_token="bot:456")
        save_workspace(s.session_id, workspace_dir="/data/workspace")

        result = complete_onboarding(s.session_id, hermes_data_dir=str(tmp_path))

        assert result["ok"] is True
        assert "config_path" in result
        assert "hermes_config" in result

        # Verify session marked complete
        assert s.completed is True

    def test_config_written_to_disk(self, tmp_path):
        s = start_session()
        save_provider(s.session_id, provider="anthropic", model="claude-sonnet-4-6")
        save_memory(s.session_id, provider="core")

        result = complete_onboarding(s.session_id, hermes_data_dir=str(tmp_path))

        config_path = tmp_path / "config.yaml"
        env_path = tmp_path / ".env"
        assert config_path.exists()
        assert env_path.exists()
