import asyncio

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, UserProfile
from app.services import onboarding_manager
from app.services.openclaw_setup import OpenClawSetup
from datetime import datetime, timezone

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


class ProfileStep(BaseModel):
    displayName: str | None = None
    bio: str | None = None
    interests: list[str] | None = None
    socialLinks: dict | None = None


class MemoryStep(BaseModel):
    provider: str


class ProviderStep(BaseModel):
    provider: str
    model: str


class PersonaStep(BaseModel):
    name: str
    prompt: str


class ChannelStep(BaseModel):
    telegram_bot_token: str | None = None
    telegram_user_id: int | None = None


@router.get("/status")
async def onboarding_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await onboarding_manager.get_status(db, user)


@router.post("/profile")
async def save_profile(body: ProfileStep, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if body.displayName:
        user.name = body.displayName
    if body.bio:
        user.bio = body.bio

    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id).limit(1))
    profile = result.scalar_one_or_none()
    if profile:
        profile.display_name = body.displayName
        profile.bio = body.bio
        profile.interests = body.interests or []
        profile.social_links = body.socialLinks or {}
        profile.updated_at = datetime.now(timezone.utc)
    else:
        db.add(UserProfile(
            user_id=user.id,
            display_name=body.displayName,
            bio=body.bio,
            interests=body.interests or [],
            social_links=body.socialLinks or {},
        ))
    await db.commit()
    return {"ok": True}


@router.post("/memory")
async def set_memory_provider(body: MemoryStep, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await onboarding_manager.save_memory(db, user, body.provider)
    return {"ok": True}


@router.get("/providers/detect")
async def detect_providers(user: User = Depends(get_current_user)):
    return onboarding_manager.detect_providers()


@router.post("/provider")
async def set_ai_provider(body: ProviderStep, user: User = Depends(get_current_user)):
    setup = OpenClawSetup(settings.workspace_dir)

    def _write() -> None:
        config = setup.generate_config(provider=body.provider, model=body.model)
        setup.write_config(config)

    await asyncio.to_thread(_write)
    return {"ok": True, "provider": body.provider, "model": body.model}


@router.post("/persona")
async def set_persona(body: PersonaStep, user: User = Depends(get_current_user)):
    setup = OpenClawSetup(settings.workspace_dir)
    await asyncio.to_thread(setup.write_persona, body.name, body.prompt)
    return {"ok": True, "name": body.name}


@router.post("/channels")
async def set_channels(body: ChannelStep, user: User = Depends(get_current_user)):
    setup = OpenClawSetup(settings.workspace_dir)

    def _write() -> None:
        config = setup.read_config()
        config.setdefault("channels", {})
        if body.telegram_bot_token:
            config["channels"]["telegram"] = {
                "enabled": True,
                "botToken": body.telegram_bot_token,
                "userId": body.telegram_user_id,
                "mode": "polling",
            }
        setup.write_config(config)

    await asyncio.to_thread(_write)
    return {"ok": True}


@router.post("/complete")
async def complete_onboarding(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await onboarding_manager.complete_onboarding(db, user)
    return result
