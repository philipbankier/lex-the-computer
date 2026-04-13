"""Automations service — wraps harness automation operations."""

from __future__ import annotations

from typing import Any

from app.harness.base import AgentHarness, Automation
from app.harness.factory import get_harness as _factory_get_harness

_harness: AgentHarness | None = None


def _get_harness() -> AgentHarness:
    global _harness
    if _harness is None:
        _harness = _factory_get_harness()
    return _harness


async def list_automations() -> list[Automation]:
    return await _get_harness().list_automations()


async def create_automation(
    name: str,
    instruction: str,
    schedule: str,
    delivery: str,
) -> Automation:
    return await _get_harness().create_automation(
        name=name,
        instruction=instruction,
        schedule=schedule,
        delivery=delivery,
    )


async def update_automation(automation_id: str, **kwargs: Any) -> Automation:
    return await _get_harness().update_automation(automation_id, **kwargs)


async def delete_automation(automation_id: str) -> bool:
    return await _get_harness().delete_automation(automation_id)


async def toggle_automation(automation_id: str) -> Automation:
    harness = _get_harness()
    automations = await harness.list_automations()
    for a in automations:
        if a.id == automation_id:
            return await harness.update_automation(
                automation_id, enabled=not a.enabled,
            )
    raise ValueError(f"Automation {automation_id} not found")
