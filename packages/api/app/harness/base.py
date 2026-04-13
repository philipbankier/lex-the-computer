"""
AgentHarness abstract base class.

Defines the interface that all harness implementations (OpenClaw, Hermes, etc.)
must satisfy. Contains only the contract — no implementation logic.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class StreamChunk:
    """A single chunk emitted during a streaming response.

    Maps to SSE events:
      - event="start"  → data is {"model": "..."}
      - event="token"  → data is a raw text string
      - event="end"    → data is {"messageId": <int>}
    """

    event: str  # "start" | "token" | "end"
    data: str | dict[str, Any]


@dataclass
class Session:
    """A conversation session managed by the harness."""

    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


@dataclass
class Automation:
    """A scheduled task (cron job) managed by the harness."""

    id: str
    name: str
    instruction: str
    schedule: str  # cron expression, e.g. "0 8 * * *"
    delivery: str  # delivery target, e.g. "telegram", "discord", "email"
    enabled: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Skill:
    """A skill available in the harness."""

    name: str
    description: str | None = None
    enabled: bool = True


@dataclass
class HarnessConfig:
    """Configuration required to instantiate an AgentHarness."""

    gateway_url: str
    gateway_token: str = ""
    agent_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Abstract base class
# ---------------------------------------------------------------------------


class AgentHarness(ABC):
    """Abstract interface for an agent harness backend.

    Concrete implementations (e.g. OpenClawHarness, HermesHarness) inherit
    from this class and provide the actual I/O with the underlying system.
    All methods are async to accommodate both WebSocket and HTTP backends.
    """

    def __init__(self, config: HarnessConfig) -> None:
        self.config = config

    # ------------------------------------------------------------------
    # Chat / Messaging
    # ------------------------------------------------------------------

    @abstractmethod
    async def send_message(
        self,
        session_id: str,
        message: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Send a message and stream the response as SSE-compatible chunks.

        Yields:
            StreamChunk(event="start", data={"model": "<model-id>"}) — once.
            StreamChunk(event="token", data="<text>") — zero or more times.
            StreamChunk(event="end",   data={"messageId": <int>}) — once.

        Args:
            session_id:   The session to post the message into.
            message:      The user message text.
            attachments:  Optional list of attachment descriptors
                          (e.g. [{"type": "image", "url": "..."}]).
        """
        ...  # pragma: no cover
        # Satisfy the type checker — implementations must use `yield`.
        yield  # type: ignore[misc]

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    @abstractmethod
    async def list_sessions(self) -> list[Session]:
        """Return all conversation sessions visible to this harness."""
        ...

    @abstractmethod
    async def get_session(self, session_id: str) -> Session | None:
        """Return a single session by ID, or None if not found."""
        ...

    @abstractmethod
    async def create_session(self, title: str | None = None) -> Session:
        """Create and return a new conversation session.

        Args:
            title: Optional human-readable title for the session.
        """
        ...

    # ------------------------------------------------------------------
    # Automations / Cron
    # ------------------------------------------------------------------

    @abstractmethod
    async def list_automations(self) -> list[Automation]:
        """Return all scheduled automations registered with the harness."""
        ...

    @abstractmethod
    async def create_automation(
        self,
        name: str,
        instruction: str,
        schedule: str,
        delivery: str,
    ) -> Automation:
        """Create a new scheduled automation.

        Args:
            name:        Human-readable label for this automation.
            instruction: The prompt/task the agent will execute on schedule.
            schedule:    Cron expression (e.g. "0 9 * * 1-5").
            delivery:    Delivery channel (e.g. "telegram", "discord", "email").
        """
        ...

    @abstractmethod
    async def update_automation(
        self,
        automation_id: str,
        **kwargs: Any,
    ) -> Automation:
        """Update fields on an existing automation and return the updated record.

        Args:
            automation_id: ID of the automation to update.
            **kwargs:      Fields to update (name, instruction, schedule,
                           delivery, enabled).
        """
        ...

    @abstractmethod
    async def delete_automation(self, automation_id: str) -> bool:
        """Delete an automation by ID.

        Returns:
            True if the automation was deleted, False if it was not found.
        """
        ...

    # ------------------------------------------------------------------
    # Skills
    # ------------------------------------------------------------------

    @abstractmethod
    async def list_skills(self) -> list[Skill]:
        """Return all skills available in the harness."""
        ...

    # ------------------------------------------------------------------
    # Gateway lifecycle
    # ------------------------------------------------------------------

    @abstractmethod
    async def start_gateway(self) -> None:
        """Start the messaging gateway (Telegram, Discord, etc.)."""
        ...

    @abstractmethod
    async def stop_gateway(self) -> None:
        """Stop the messaging gateway."""
        ...

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    @abstractmethod
    async def health_check(self) -> dict[str, Any]:
        """Return a health-status dictionary for this harness.

        The returned dict should include at minimum:
          - "status": "ok" | "degraded" | "down"
          - "gateway": connection state of the gateway
        Additional keys are implementation-specific.
        """
        ...
