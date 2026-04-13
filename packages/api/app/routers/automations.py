"""
Automations router — CRUD for scheduled OpenClaw cron jobs.

Endpoints:
  GET    /api/automations          list all automations
  POST   /api/automations          create an automation
  PATCH  /api/automations/{id}     update an automation
  DELETE /api/automations/{id}     delete an automation
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.routers.chat import get_harness

router = APIRouter(prefix="/api/automations", tags=["automations"])


# ---------------------------------------------------------------------------
# Request/response schemas
# ---------------------------------------------------------------------------


class CreateAutomationRequest(BaseModel):
    name: str
    instruction: str
    schedule: str
    delivery: str


class UpdateAutomationRequest(BaseModel):
    name: str | None = None
    instruction: str | None = None
    schedule: str | None = None
    delivery: str | None = None
    enabled: bool | None = None


def _automation_to_dict(a) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "instruction": a.instruction,
        "schedule": a.schedule,
        "delivery": a.delivery,
        "enabled": a.enabled,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def list_automations():
    harness = get_harness()
    automations = await harness.list_automations()
    return [_automation_to_dict(a) for a in automations]


@router.post("")
async def create_automation(body: CreateAutomationRequest):
    harness = get_harness()
    automation = await harness.create_automation(
        name=body.name,
        instruction=body.instruction,
        schedule=body.schedule,
        delivery=body.delivery,
    )
    return _automation_to_dict(automation)


@router.patch("/{automation_id}")
async def update_automation(automation_id: str, body: UpdateAutomationRequest):
    harness = get_harness()
    try:
        automation = await harness.update_automation(
            automation_id,
            **{k: v for k, v in body.model_dump().items() if v is not None},
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _automation_to_dict(automation)


@router.delete("/{automation_id}")
async def delete_automation(automation_id: str):
    harness = get_harness()
    deleted = await harness.delete_automation(automation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"deleted": True}
