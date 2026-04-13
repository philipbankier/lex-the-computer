"""
OpenClawHarness — AgentHarness implementation backed by the OpenClaw WebSocket gateway.

Protocol:
  1. Connect and authenticate via a "connect" request.
  2. Send messages via an "agent" request; stream "agent" events as SSE tokens.
  3. Automations are proxied to the OpenClaw CLI (`openclaw cron ...`).
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

import websockets

from app.harness.base import (
    AgentHarness,
    Automation,
    HarnessConfig,
    Session,
    Skill,
    StreamChunk,
)


class OpenClawHarness(AgentHarness):
    """Concrete harness that speaks the OpenClaw WebSocket protocol."""

    def __init__(self, config: HarnessConfig) -> None:
        super().__init__(config)
        # In-memory session store (session_id → Session).
        self._sessions: dict[str, Session] = {}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _connect(self) -> websockets.WebSocketClientProtocol:
        """Open a WebSocket connection and authenticate."""
        ws = await websockets.connect(self.config.gateway_url)
        auth_req = {
            "type": "req",
            "id": "1",
            "method": "connect",
            "params": {"auth": {"token": self.config.gateway_token}},
        }
        await ws.send(json.dumps(auth_req))
        # Wait for hello-ok (skip any other messages).
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "hello-ok":
                break
            if msg.get("type") == "error":
                await ws.close()
                raise RuntimeError(f"OpenClaw auth error: {msg}")
        return ws

    # ------------------------------------------------------------------
    # Chat / Messaging
    # ------------------------------------------------------------------

    async def send_message(
        self,
        session_id: str,
        message: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Stream a response from the OpenClaw gateway as SSE chunks."""
        req_id = str(uuid.uuid4())

        ws = await self._connect()
        try:
            yield StreamChunk(event="start", data={"model": "openclaw"})

            agent_req = {
                "type": "req",
                "id": req_id,
                "method": "agent",
                "params": {
                    "sessionKey": session_id,
                    "message": message,
                },
            }
            await ws.send(json.dumps(agent_req))

            async for raw in ws:
                msg = json.loads(raw)

                # Terminal response signals end of stream.
                if msg.get("type") == "res" and msg.get("id") == req_id:
                    break

                # Agent event — emit a token chunk.
                if msg.get("event") == "agent":
                    payload = msg.get("payload", "")
                    if payload:
                        yield StreamChunk(event="token", data=payload)

            yield StreamChunk(event="end", data={"messageId": 0})
        finally:
            await ws.close()

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    async def list_sessions(self) -> list[Session]:
        return list(self._sessions.values())

    async def get_session(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    async def create_session(self, title: str | None = None) -> Session:
        session_id = str(uuid.uuid4())
        now = datetime.now(tz=timezone.utc)
        session = Session(
            id=session_id,
            title=title or f"Chat {now.strftime('%b %d %H:%M')}",
            created_at=now,
            updated_at=now,
        )
        self._sessions[session_id] = session
        return session

    # ------------------------------------------------------------------
    # Automations / Cron
    # ------------------------------------------------------------------

    def _run_cli(self, args: list[str]) -> str:
        """Run an openclaw CLI command and return stdout."""
        result = subprocess.run(
            ["openclaw", *args],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout

    async def list_automations(self) -> list[Automation]:
        try:
            loop = asyncio.get_event_loop()
            raw = await loop.run_in_executor(
                None, lambda: self._run_cli(["cron", "list", "--json"])
            )
            jobs = json.loads(raw) if raw.strip() else []
            automations = []
            for job in jobs:
                automations.append(
                    Automation(
                        id=job.get("id", str(uuid.uuid4())),
                        name=job.get("name", ""),
                        instruction=job.get("message", ""),
                        schedule=job.get("cron", ""),
                        delivery=job.get("agent", ""),
                        enabled=not job.get("disabled", False),
                    )
                )
            return automations
        except Exception:
            return []

    async def create_automation(
        self,
        name: str,
        instruction: str,
        schedule: str,
        delivery: str,
    ) -> Automation:
        automation_id = str(uuid.uuid4())
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._run_cli(
                [
                    "cron",
                    "add",
                    "--name",
                    name,
                    "--cron",
                    schedule,
                    "--message",
                    instruction,
                    "--agent",
                    delivery,
                ]
            ),
        )
        return Automation(
            id=automation_id,
            name=name,
            instruction=instruction,
            schedule=schedule,
            delivery=delivery,
            enabled=True,
            created_at=datetime.now(tz=timezone.utc),
        )

    async def update_automation(
        self,
        automation_id: str,
        **kwargs: Any,
    ) -> Automation:
        # OpenClaw CLI doesn't support in-place update — delete + recreate.
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, lambda: self._run_cli(["cron", "rm", automation_id])
        )
        return await self.create_automation(
            name=kwargs.get("name", ""),
            instruction=kwargs.get("instruction", ""),
            schedule=kwargs.get("schedule", ""),
            delivery=kwargs.get("delivery", ""),
        )

    async def delete_automation(self, automation_id: str) -> bool:
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, lambda: self._run_cli(["cron", "rm", automation_id])
            )
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Skills
    # ------------------------------------------------------------------

    async def list_skills(self) -> list[Skill]:
        return []

    # ------------------------------------------------------------------
    # Gateway lifecycle
    # ------------------------------------------------------------------

    async def start_gateway(self) -> None:
        pass

    async def stop_gateway(self) -> None:
        pass

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    async def health_check(self) -> dict[str, Any]:
        try:
            ws = await asyncio.wait_for(self._connect(), timeout=5)
            await ws.close()
            gateway_status = "connected"
        except Exception as exc:
            gateway_status = f"error: {exc}"

        return {
            "status": "ok" if gateway_status == "connected" else "degraded",
            "gateway": gateway_status,
        }
