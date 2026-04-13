import logging
from datetime import datetime, timezone
from urllib.parse import urlencode

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.integration import Integration

logger = logging.getLogger(__name__)

OAUTH_CONFIGS: dict[str, dict] = {
    "google": {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scopes": {
            "gmail": "https://www.googleapis.com/auth/gmail.readonly",
            "calendar": "https://www.googleapis.com/auth/calendar",
            "drive": "https://www.googleapis.com/auth/drive.readonly",
        },
        "client_id_key": "google_client_id",
        "client_secret_key": "google_client_secret",
    },
    "notion": {
        "auth_url": "https://api.notion.com/v1/oauth/authorize",
        "token_url": "https://api.notion.com/v1/oauth/token",
        "scopes": {},
        "client_id_key": "notion_client_id",
        "client_secret_key": "notion_client_secret",
    },
    "github": {
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "scopes": {"default": "repo,user"},
        "client_id_key": "github_client_id",
        "client_secret_key": "github_client_secret",
    },
    "linear": {
        "auth_url": "https://linear.app/oauth/authorize",
        "token_url": "https://api.linear.app/oauth/token",
        "scopes": {"default": "read,write"},
        "client_id_key": "linear_client_id",
        "client_secret_key": "linear_client_secret",
    },
    "dropbox": {
        "auth_url": "https://www.dropbox.com/oauth2/authorize",
        "token_url": "https://api.dropboxapi.com/oauth2/token",
        "scopes": {},
        "client_id_key": "dropbox_client_id",
        "client_secret_key": "dropbox_client_secret",
    },
    "spotify": {
        "auth_url": "https://accounts.spotify.com/authorize",
        "token_url": "https://accounts.spotify.com/api/token",
        "scopes": {"default": "user-read-playback-state user-read-currently-playing"},
        "client_id_key": "spotify_client_id",
        "client_secret_key": "spotify_client_secret",
    },
    "microsoft": {
        "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "scopes": {"default": "openid profile email User.Read"},
        "client_id_key": "microsoft_client_id",
        "client_secret_key": "microsoft_client_secret",
    },
}


async def list_integrations(db: AsyncSession, user_id: int) -> list[Integration]:
    result = await db.execute(
        select(Integration).where(Integration.user_id == user_id).order_by(Integration.connected_at.desc())
    )
    return list(result.scalars().all())


async def get_integration(db: AsyncSession, user_id: int, integration_id: int) -> Integration | None:
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id, Integration.user_id == user_id)
    )
    return result.scalar_one_or_none()


def get_oauth_url(provider: str, service: str | None = None) -> str:
    config = OAUTH_CONFIGS.get(provider)
    if config is None:
        raise ValueError(f"Unknown provider: {provider}")

    client_id = getattr(settings, config["client_id_key"], "")
    if not client_id:
        raise ValueError(f"OAuth not configured for {provider}")

    redirect_uri = f"{settings.base_url}/api/integrations/{provider}/callback"
    scopes = config["scopes"]
    scope = scopes.get(service or "default", next(iter(scopes.values()), ""))

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
    }

    return f"{config['auth_url']}?{urlencode(params)}"


async def handle_oauth_callback(
    db: AsyncSession, user_id: int, provider: str, code: str, service: str | None = None
) -> Integration:
    config = OAUTH_CONFIGS.get(provider)
    if config is None:
        raise ValueError(f"Unknown provider: {provider}")

    import httpx
    client_id = getattr(settings, config["client_id_key"], "")
    client_secret = getattr(settings, config["client_secret_key"], "")
    redirect_uri = f"{settings.base_url}/api/integrations/{provider}/callback"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            config["token_url"],
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        tokens = resp.json()

    label = service or provider
    integration = Integration(
        user_id=user_id,
        provider=provider,
        label=label,
        access_token=tokens.get("access_token", ""),
        refresh_token=tokens.get("refresh_token"),
        scope=tokens.get("scope", ""),
    )
    if "expires_in" in tokens:
        from datetime import timedelta
        integration.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])

    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return integration


async def create_token_integration(
    db: AsyncSession,
    user_id: int,
    *,
    provider: str,
    access_token: str,
    refresh_token: str | None = None,
    scope: str | None = None,
    account_email: str | None = None,
    account_name: str | None = None,
) -> Integration:
    integration = Integration(
        user_id=user_id,
        provider=provider,
        label=provider,
        access_token=access_token,
        refresh_token=refresh_token,
        scope=scope or "",
        account_email=account_email,
        account_name=account_name,
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return integration


async def disconnect_integration(db: AsyncSession, user_id: int, integration_id: int) -> bool:
    integration = await get_integration(db, user_id, integration_id)
    if integration is None:
        return False
    await db.delete(integration)
    await db.commit()
    return True


async def refresh_token(db: AsyncSession, integration: Integration) -> Integration | None:
    if not integration.refresh_token:
        return None

    provider = integration.provider
    config = OAUTH_CONFIGS.get(provider)
    if config is None:
        return None

    import httpx
    client_id = getattr(settings, config["client_id_key"], "")
    client_secret = getattr(settings, config["client_secret_key"], "")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            config["token_url"],
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": integration.refresh_token,
                "grant_type": "refresh_token",
            },
            headers={"Accept": "application/json"},
        )
        tokens = resp.json()

    if "access_token" in tokens:
        integration.access_token = tokens["access_token"]
        if "refresh_token" in tokens:
            integration.refresh_token = tokens["refresh_token"]
        if "expires_in" in tokens:
            from datetime import timedelta
            integration.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
        integration.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(integration)
    return integration
