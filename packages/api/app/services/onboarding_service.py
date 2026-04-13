"""
Onboarding service — manages wizard state and config generation.

Tracks onboarding progress in-memory so users can resume mid-flow.
After step 5 completes, writes Hermes config files to disk.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from app.services.hermes_config import generate_hermes_config, write_hermes_config

STEP_NAMES = ["account", "provider", "memory", "channels", "workspace"]


@dataclass
class OnboardingSession:
    session_id: str
    current_step: int = 1
    completed: bool = False
    account: dict[str, Any] = field(default_factory=dict)
    provider: dict[str, Any] = field(default_factory=dict)
    memory: dict[str, Any] = field(default_factory=dict)
    channels: dict[str, Any] = field(default_factory=dict)
    workspace: dict[str, Any] = field(default_factory=dict)

    def step_status(self) -> dict[str, bool]:
        return {
            "account": bool(self.account),
            "provider": bool(self.provider),
            "memory": bool(self.memory),
            "channels": True,  # optional step, always "done"
            "workspace": bool(self.workspace),
        }

    def to_status(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "current_step": self.current_step,
            "completed": self.completed,
            "steps": self.step_status(),
        }


_sessions: dict[str, OnboardingSession] = {}


def start_session() -> OnboardingSession:
    session_id = str(uuid.uuid4())
    session = OnboardingSession(session_id=session_id)
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> OnboardingSession | None:
    return _sessions.get(session_id)


def save_account(
    session_id: str,
    *,
    email: str | None = None,
    password: str | None = None,
    single_user: bool = False,
) -> OnboardingSession:
    session = _sessions[session_id]
    session.account = {"email": email, "password": password, "single_user": single_user}
    if session.current_step < 2:
        session.current_step = 2
    return session


def save_provider(
    session_id: str,
    *,
    provider: str,
    model: str,
    api_key: str = "",
) -> OnboardingSession:
    session = _sessions[session_id]
    session.provider = {"provider": provider, "model": model, "api_key": api_key}
    if session.current_step < 3:
        session.current_step = 3
    return session


def save_memory(session_id: str, *, provider: str) -> OnboardingSession:
    session = _sessions[session_id]
    session.memory = {"provider": provider}
    if session.current_step < 4:
        session.current_step = 4
    return session


def save_channels(
    session_id: str,
    *,
    telegram_bot_token: str | None = None,
    telegram_user_id: int | None = None,
    discord_bot_token: str | None = None,
) -> OnboardingSession:
    session = _sessions[session_id]
    session.channels = {
        "telegram_bot_token": telegram_bot_token,
        "telegram_user_id": telegram_user_id,
        "discord_bot_token": discord_bot_token,
    }
    if session.current_step < 5:
        session.current_step = 5
    return session


def save_workspace(session_id: str, *, workspace_dir: str) -> OnboardingSession:
    session = _sessions[session_id]
    session.workspace = {"workspace_dir": workspace_dir}
    return session


def complete_onboarding(session_id: str, hermes_data_dir: str) -> dict[str, Any]:
    """Finalize onboarding: generate and write Hermes config."""
    session = _sessions[session_id]

    prov = session.provider
    mem = session.memory
    ch = session.channels
    ws = session.workspace

    result = generate_hermes_config(
        provider=prov.get("provider", "anthropic"),
        model=prov.get("model", "claude-sonnet-4-6"),
        api_key=prov.get("api_key", ""),
        memory_provider=mem.get("provider", "core"),
        telegram_bot_token=ch.get("telegram_bot_token") or "",
        telegram_user_id=ch.get("telegram_user_id"),
        discord_bot_token=ch.get("discord_bot_token") or "",
        workspace_dir=ws.get("workspace_dir", "/data/workspace"),
    )

    config_path = write_hermes_config(
        hermes_data_dir=hermes_data_dir,
        config=result["config"],
        env=result["env"],
    )

    session.completed = True

    return {
        "ok": True,
        "config_path": str(config_path),
        "hermes_config": result["config"],
    }
