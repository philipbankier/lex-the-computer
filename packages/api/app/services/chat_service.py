"""Chat service — business logic for chat operations."""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Any

from app.harness.base import AgentHarness, Session, StreamChunk

logger = logging.getLogger(__name__)

_MAX_TITLE_LENGTH = 50


def _auto_title(message: str) -> str:
    title = message.strip().split("\n")[0]
    if len(title) > _MAX_TITLE_LENGTH:
        title = title[:_MAX_TITLE_LENGTH].rsplit(" ", 1)[0] + "\u2026"
    return title


class ChatService:
    """Chat operations on top of an AgentHarness."""

    def __init__(self, harness: AgentHarness) -> None:
        self._harness = harness

    async def create_conversation(self, title: str | None = None) -> Session:
        return await self._harness.create_session(title=title)

    async def list_conversations(self) -> list[Session]:
        return await self._harness.list_sessions()

    async def get_conversation(self, conversation_id: str) -> Session | None:
        return await self._harness.get_session(conversation_id)

    async def delete_conversation(self, conversation_id: str) -> bool:
        if hasattr(self._harness, "delete_session"):
            return await self._harness.delete_session(conversation_id)
        return False

    def send_message_stream(
        self,
        message: str,
        conversation_id: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Return the harness streaming generator for a message."""
        return self._harness.send_message(
            session_id=conversation_id,
            message=message,
            attachments=attachments,
        )

    async def send_message(
        self,
        message: str,
        conversation_id: str | None = None,
        attachments: list[dict[str, Any]] | None = None,
    ) -> tuple[str, AsyncGenerator[StreamChunk, None]]:
        """Send a message, auto-creating a conversation if needed.

        Returns (conversation_id, chunk_stream).
        """
        if not conversation_id:
            title = _auto_title(message)
            session = await self._harness.create_session(title=title)
            conversation_id = session.id

        stream = self.send_message_stream(
            message=message,
            conversation_id=conversation_id,
            attachments=attachments,
        )
        return conversation_id, stream
