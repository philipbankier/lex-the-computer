"""
Automations router — CRUD for scheduled cron jobs via Hermes harness.

Endpoints:
  GET    /api/automations                list all automations
  POST   /api/automations                create an automation
  PATCH  /api/automations/{id}           update an automation
  DELETE /api/automations/{id}           delete an automation
  POST   /api/automations/{id}/toggle    enable / disable
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.automations import AutomationCreate, AutomationUpdate
from app.services import automations_service

router = APIRouter(prefix="/api/automations", tags=["automations"])


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


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


@router.get("")
async def list_automations():
    automations = await automations_service.list_automations()
    return [_automation_to_dict(a) for a in automations]


@router.post("")
async def create_automation(body: AutomationCreate):
    automation = await automations_service.create_automation(
        name=body.name,
        instruction=body.instruction,
        schedule=body.schedule,
        delivery=body.delivery,
    )
    return _automation_to_dict(automation)


@router.patch("/{automation_id}")
async def update_automation(automation_id: str, body: AutomationUpdate):
    try:
        automation = await automations_service.update_automation(
            automation_id,
            **{k: v for k, v in body.model_dump().items() if v is not None},
        )
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _automation_to_dict(automation)


@router.delete("/{automation_id}")
async def delete_automation(automation_id: str):
    deleted = await automations_service.delete_automation(automation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"deleted": True}


@router.post("/{automation_id}/toggle")
async def toggle_automation(automation_id: str):
    try:
        automation = await automations_service.toggle_automation(automation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _automation_to_dict(automation)
