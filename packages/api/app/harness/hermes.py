"""
HermesHarness — AgentHarness implementation backed by the Hermes HTTP API server.

Hermes exposes an OpenAI-compatible HTTP API:
  - POST /v1/chat/completions   — stateless chat
  - POST /v1/responses          — stateful (named conversations)
  - GET  /v1/models             — list models
  - GET  /health                — health check

Auth: Authorization: Bearer <API_SERVER_KEY>
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.harness.base import (
    AgentHarness,
    Automation,
    HarnessConfig,
    Session,
    Skill,
    StreamChunk,
)


class HermesHarness(AgentHarness):
    """Concrete harness that speaks the Hermes OpenAI-compatible HTTP API."""

    def __init__(self, config: HarnessConfig) -> None:
        super().__init__(config)
        self._base_url = config.gateway_url.rstrip("/")
        self._api_key = config.gateway_token
        self._data_dir = Path(config.extra.get("data_dir", "/data/hermes"))

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self._api_key:
            h["Authorization"] = f"Bearer {self._api_key}"
        return h

    # ------------------------------------------------------------------
    # Chat / Messaging
    # ------------------------------------------------------------------

    async def send_message(
        self,
        session_id: str,
        message: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Stream a response from Hermes via the Responses API (stateful)."""
        yield StreamChunk(event="start", data={"model": "hermes"})

        body: dict[str, Any] = {
            "model": "default",
            "input": message,
            "stream": True,
            "conversation": session_id,
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0)) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/v1/responses",
                headers=self._headers(),
                json=body,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload == "[DONE]":
                        break
                    try:
                        event = json.loads(payload)
                    except json.JSONDecodeError:
                        continue

                    # Hermes streams OpenAI-compatible SSE events.
                    # Extract delta text from response.output items.
                    if event.get("type") == "response.output_text.delta":
                        delta = event.get("delta", "")
                        if delta:
                            yield StreamChunk(event="token", data=delta)

        yield StreamChunk(event="end", data={"messageId": 0})

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    async def list_sessions(self) -> list[Session]:
        # Hermes stores sessions in state.db (SQLite) on shared volume.
        # Full implementation in R5; return empty for now.
        return []

    async def get_session(self, session_id: str) -> Session | None:
        return None

    async def create_session(self, title: str | None = None) -> Session:
        session_id = str(uuid.uuid4())
        now = datetime.now(tz=timezone.utc)
        return Session(
            id=session_id,
            title=title or f"Chat {now.strftime('%b %d %H:%M')}",
            created_at=now,
            updated_at=now,
        )

    # ------------------------------------------------------------------
    # Automations / Cron
    # ------------------------------------------------------------------

    def _cron_file(self) -> Path:
        return self._data_dir / "cron" / "jobs.json"

    def _read_cron_jobs(self) -> list[dict[str, Any]]:
        path = self._cron_file()
        if not path.exists():
            return []
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []

    def _write_cron_jobs(self, jobs: list[dict[str, Any]]) -> None:
        path = self._cron_file()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(jobs, indent=2), encoding="utf-8")

    async def list_automations(self) -> list[Automation]:
        jobs = self._read_cron_jobs()
        return [
            Automation(
                id=j.get("id", ""),
                name=j.get("name", ""),
                instruction=j.get("message", ""),
                schedule=j.get("cron", ""),
                delivery=j.get("delivery", ""),
                enabled=not j.get("disabled", False),
            )
            for j in jobs
        ]

    async def create_automation(
        self,
        name: str,
        instruction: str,
        schedule: str,
        delivery: str,
    ) -> Automation:
        automation_id = str(uuid.uuid4())
        now = datetime.now(tz=timezone.utc)
        job = {
            "id": automation_id,
            "name": name,
            "message": instruction,
            "cron": schedule,
            "delivery": delivery,
            "disabled": False,
            "created_at": now.isoformat(),
        }
        jobs = self._read_cron_jobs()
        jobs.append(job)
        self._write_cron_jobs(jobs)
        return Automation(
            id=automation_id,
            name=name,
            instruction=instruction,
            schedule=schedule,
            delivery=delivery,
            enabled=True,
            created_at=now,
        )

    async def update_automation(self, automation_id: str, **kwargs: Any) -> Automation:
        jobs = self._read_cron_jobs()
        for job in jobs:
            if job.get("id") == automation_id:
                if "name" in kwargs:
                    job["name"] = kwargs["name"]
                if "instruction" in kwargs:
                    job["message"] = kwargs["instruction"]
                if "schedule" in kwargs:
                    job["cron"] = kwargs["schedule"]
                if "delivery" in kwargs:
                    job["delivery"] = kwargs["delivery"]
                if "enabled" in kwargs:
                    job["disabled"] = not kwargs["enabled"]
                job["updated_at"] = datetime.now(tz=timezone.utc).isoformat()
                self._write_cron_jobs(jobs)
                return Automation(
                    id=automation_id,
                    name=job.get("name", ""),
                    instruction=job.get("message", ""),
                    schedule=job.get("cron", ""),
                    delivery=job.get("delivery", ""),
                    enabled=not job.get("disabled", False),
                )
        raise ValueError(f"Automation {automation_id} not found")

    async def delete_automation(self, automation_id: str) -> bool:
        jobs = self._read_cron_jobs()
        original_len = len(jobs)
        jobs = [j for j in jobs if j.get("id") != automation_id]
        if len(jobs) == original_len:
            return False
        self._write_cron_jobs(jobs)
        return True

    # ------------------------------------------------------------------
    # Skills
    # ------------------------------------------------------------------

    async def list_skills(self) -> list[Skill]:
        skills_dir = self._data_dir / "skills"
        if not skills_dir.exists():
            return []
        skills = []
        for entry in skills_dir.iterdir():
            if entry.is_dir():
                skills.append(Skill(name=entry.name, description=None, enabled=True))
        return skills

    # ------------------------------------------------------------------
    # Gateway lifecycle
    # ------------------------------------------------------------------

    async def start_gateway(self) -> None:
        pass  # Hermes runs as a separate Docker container

    async def stop_gateway(self) -> None:
        pass  # Hermes runs as a separate Docker container

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    async def health_check(self) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self._base_url}/health",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return {"status": "ok", "gateway": "connected"}
        except Exception as exc:
            return {"status": "degraded", "gateway": f"error: {exc}"}
