"""
Honcho memory bridge service.

Sits between the chat flow and Honcho, feeding conversation turns to the
dialectic user model and syncing insights back to OpenClaw's USER.md workspace
file so the agent naturally picks them up on the next conversation.
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)


class HonchoBridge:
    """Bridge between Lex's chat flow and Honcho's dialectic user modeling."""

    def __init__(self, user_handle: str, workspace_dir: str, honcho_base_url: str) -> None:
        self.user_handle = user_handle
        self.workspace_dir = workspace_dir
        self.honcho_base_url = honcho_base_url.rstrip("/")
        self._honcho = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_client(self):
        """Return a lazily-initialised Honcho SDK client, or None on failure."""
        if self._honcho is not None:
            return self._honcho
        try:
            from honcho import Honcho  # honcho-ai >= 2.1

            self._honcho = Honcho(
                workspace_id=f"lex-{self.user_handle}",
                base_url=self.honcho_base_url,
            )
            return self._honcho
        except Exception as exc:
            logger.warning("Failed to initialise Honcho client: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def verify_connection(self) -> bool:
        """Return True if the Honcho API is reachable, False otherwise."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.honcho_base_url}/healthz")
                reachable = response.status_code < 500
        except Exception as exc:
            logger.warning("Honcho API not reachable at %s: %s", self.honcho_base_url, exc)
            reachable = False

        if not reachable:
            logger.warning("Honcho unavailable — memory features will be skipped")
        return reachable

    async def on_conversation_turn(
        self,
        user_message: str,
        assistant_response: str,
        session_id: str,
    ) -> None:
        """Feed a conversation exchange to Honcho asynchronously (non-blocking).

        Called after each chat round-trip. Failures are logged but never raised
        so the chat path is never disrupted by Honcho unavailability.
        """
        honcho = self._get_client()
        if honcho is None:
            logger.warning("Honcho unavailable, skipping conversation turn ingestion")
            return

        def _sync_add() -> None:
            peer = honcho.peer(self.user_handle)
            session = honcho.session(session_id)
            session.add_messages(
                [
                    peer.message(user_message),
                    honcho.peer("lex").message(assistant_response),
                ]
            )

        try:
            await asyncio.to_thread(_sync_add)
        except Exception as exc:
            logger.warning("Honcho add_messages failed: %s", exc)

    async def get_user_context(self) -> str:
        """Query Honcho for a dialectic summary of the user's preferences.

        Returns an empty string when Honcho is unavailable so callers can
        treat the result as optional context rather than a hard requirement.
        """
        honcho = self._get_client()
        if honcho is None:
            logger.warning("Honcho unavailable, returning empty user context")
            return ""

        def _sync_query() -> str:
            peer = honcho.peer(self.user_handle)
            return peer.chat(
                "Summarize this user's preferences, communication style, "
                "and current focus areas."
            )

        try:
            insights: str = await asyncio.to_thread(_sync_query)
            return insights
        except Exception as exc:
            logger.warning("Honcho peer.chat failed: %s", exc)
            return ""

    async def sync_to_workspace(self) -> None:
        """Write Honcho insights to USER.md inside the workspace directory.

        File format::

            # User Profile (auto-updated by Honcho)

            {insights}

            Last updated: {timestamp}

        If insights are empty (e.g. Honcho is unreachable) the file is not
        written so the previous version is preserved.
        """
        insights = await self.get_user_context()
        if not insights:
            logger.warning("No Honcho insights available, skipping USER.md sync")
            return

        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        content = (
            "# User Profile (auto-updated by Honcho)\n\n"
            f"{insights}\n\n"
            f"Last updated: {timestamp}\n"
        )

        user_md = Path(self.workspace_dir) / "USER.md"

        def _sync_write() -> None:
            user_md.parent.mkdir(parents=True, exist_ok=True)
            user_md.write_text(content, encoding="utf-8")

        try:
            await asyncio.to_thread(_sync_write)
            logger.info("Synced Honcho user insights to %s", user_md)
        except Exception as exc:
            logger.warning("Failed to write USER.md: %s", exc)
