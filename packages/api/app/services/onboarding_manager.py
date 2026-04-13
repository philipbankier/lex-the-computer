from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.hermes_config import generate_hermes_config
from app.services.openclaw_setup import OpenClawSetup


async def get_status(db: AsyncSession, user: User) -> dict:
    has_name = bool(user.name)
    has_handle = bool(user.handle)
    return {
        "completed": user.onboarding_completed,
        "current_step": None if user.onboarding_completed else _next_step(user),
        "steps": {
            "profile": has_name and has_handle,
            "memory": bool(user.memory_provider),
            "provider": bool(user.settings and user.settings.get("provider")),
            "persona": bool(user.settings and user.settings.get("persona")),
            "channels": bool(user.settings and user.settings.get("channels")),
        },
    }


def _next_step(user: User) -> str:
    if not user.name or not user.handle:
        return "profile"
    if not user.memory_provider:
        return "memory"
    s = user.settings or {}
    if not s.get("provider"):
        return "provider"
    if not s.get("persona"):
        return "persona"
    if not s.get("channels"):
        return "channels"
    return "complete"


async def save_profile(db: AsyncSession, user: User, name: str, handle: str | None = None, bio: str | None = None) -> User:
    user.name = name
    if handle:
        user.handle = handle
    if bio:
        user.bio = bio
    await db.commit()
    await db.refresh(user)
    return user


async def save_memory(db: AsyncSession, user: User, provider: str) -> User:
    user.memory_provider = provider
    await db.commit()
    await db.refresh(user)
    return user


async def save_provider(db: AsyncSession, user: User, provider: str, model: str | None = None, api_key: str | None = None) -> User:
    s = dict(user.settings or {})
    s["provider"] = {"id": provider, "model": model, "api_key": api_key}
    user.settings = s
    await db.commit()
    await db.refresh(user)
    return user


async def save_persona(db: AsyncSession, user: User, name: str, prompt: str) -> User:
    s = dict(user.settings or {})
    s["persona"] = {"name": name, "prompt": prompt}
    user.settings = s
    await db.commit()
    await db.refresh(user)
    return user


async def save_channels(
    db: AsyncSession, user: User, telegram_bot_token: str | None = None, discord_bot_token: str | None = None
) -> User:
    s = dict(user.settings or {})
    channels = {}
    if telegram_bot_token:
        channels["telegram"] = {"bot_token": telegram_bot_token}
    if discord_bot_token:
        channels["discord"] = {"bot_token": discord_bot_token}
    s["channels"] = channels
    user.settings = s
    await db.commit()
    await db.refresh(user)
    return user


async def complete_onboarding(db: AsyncSession, user: User) -> dict:
    user.onboarding_completed = True
    await db.commit()

    s = user.settings or {}
    provider_info = s.get("provider", {})
    channels = s.get("channels", {})
    persona = s.get("persona", {})

    hermes_output = generate_hermes_config(
        provider=provider_info.get("id", "anthropic"),
        api_key=provider_info.get("api_key", ""),
        memory_provider=user.memory_provider or "core",
        telegram_bot_token=channels.get("telegram", {}).get("bot_token", ""),
        discord_bot_token=channels.get("discord", {}).get("bot_token", ""),
    )

    from app.config import settings
    setup = OpenClawSetup(settings.workspace_dir)
    if provider_info.get("id"):
        config = setup.generate_config(
            provider=provider_info["id"],
            model=provider_info.get("model", "sonnet"),
            telegram_config=channels.get("telegram"),
        )
        setup.write_config(config)

    if persona.get("name"):
        setup.write_persona(persona["name"], persona.get("prompt", ""))

    return {
        "ok": True,
        "hermes_config": hermes_output.get("config"),
    }


def detect_providers() -> list[dict]:
    from app.config import settings
    setup = OpenClawSetup(settings.workspace_dir)
    return setup.detect_cli_providers()
