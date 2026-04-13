"""
Onboarding router — 5-step wizard that configures Hermes for a new Lex user.

Steps:
  1. Account   — create account or single-user mode
  2. Provider  — choose AI model + API key
  3. Memory    — deep (Honcho) or light (core)
  4. Channels  — Telegram / Discord tokens (optional)
  5. Workspace — file storage location
"""

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas.onboarding import (
    AccountStep,
    ChannelStep,
    MemoryStep,
    OnboardingStartResponse,
    OnboardingStatus,
    ProviderStep,
    WorkspaceStep,
)
from app.services import onboarding_service

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _get_session(session_id: str) -> onboarding_service.OnboardingSession:
    session = onboarding_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Onboarding session not found")
    return session


@router.post("/start", response_model=OnboardingStartResponse)
async def start_onboarding():
    session = onboarding_service.start_session()
    return OnboardingStartResponse(session_id=session.session_id, current_step=session.current_step)


@router.get("/status", response_model=OnboardingStatus)
async def onboarding_status(session_id: str):
    session = _get_session(session_id)
    return session.to_status()


@router.post("/account")
async def save_account(session_id: str, body: AccountStep):
    _get_session(session_id)
    session = onboarding_service.save_account(
        session_id,
        email=str(body.email) if body.email else None,
        password=body.password,
        single_user=body.single_user,
    )
    return {"ok": True, "current_step": session.current_step}


@router.post("/provider")
async def save_provider(session_id: str, body: ProviderStep):
    _get_session(session_id)
    session = onboarding_service.save_provider(
        session_id,
        provider=body.provider,
        model=body.model,
        api_key=body.api_key,
    )
    return {"ok": True, "current_step": session.current_step}


@router.post("/memory")
async def save_memory(session_id: str, body: MemoryStep):
    _get_session(session_id)
    session = onboarding_service.save_memory(session_id, provider=body.provider)
    return {"ok": True, "current_step": session.current_step}


@router.post("/channels")
async def save_channels(session_id: str, body: ChannelStep):
    _get_session(session_id)
    session = onboarding_service.save_channels(
        session_id,
        telegram_bot_token=body.telegram_bot_token,
        telegram_user_id=body.telegram_user_id,
        discord_bot_token=body.discord_bot_token,
    )
    return {"ok": True, "current_step": session.current_step}


@router.post("/workspace")
async def save_workspace(session_id: str, body: WorkspaceStep):
    _get_session(session_id)
    session = onboarding_service.save_workspace(session_id, workspace_dir=body.workspace_dir)
    return {"ok": True, "current_step": session.current_step}


@router.post("/complete")
async def complete_onboarding(session_id: str):
    session = _get_session(session_id)
    if not session.provider:
        raise HTTPException(status_code=400, detail="AI provider must be configured before completing onboarding")
    result = onboarding_service.complete_onboarding(session_id, hermes_data_dir=settings.hermes_data_dir)
    return result
