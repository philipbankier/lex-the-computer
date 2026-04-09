from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.integration import Integration

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# OAuth2 provider configurations
PROVIDERS = {
    "gmail": {
        "name": "Gmail", "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        "scopes": {"read": "https://www.googleapis.com/auth/gmail.readonly", "readwrite": "https://www.googleapis.com/auth/gmail.modify"},
        "client_id_key": "google_client_id", "client_secret_key": "google_client_secret",
    },
    "google-calendar": {
        "name": "Google Calendar", "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/calendar/v3/calendars/primary",
        "scopes": {"read": "https://www.googleapis.com/auth/calendar.readonly", "readwrite": "https://www.googleapis.com/auth/calendar"},
        "client_id_key": "google_client_id", "client_secret_key": "google_client_secret",
    },
    "google-drive": {
        "name": "Google Drive", "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/drive/v3/about?fields=user",
        "scopes": {"read": "https://www.googleapis.com/auth/drive.readonly", "readwrite": "https://www.googleapis.com/auth/drive"},
        "client_id_key": "google_client_id", "client_secret_key": "google_client_secret",
    },
    "notion": {
        "name": "Notion", "auth_url": "https://api.notion.com/v1/oauth/authorize",
        "token_url": "https://api.notion.com/v1/oauth/token",
        "userinfo_url": "https://api.notion.com/v1/users/me",
        "scopes": {"read": "", "readwrite": ""},
        "client_id_key": "notion_client_id", "client_secret_key": "notion_client_secret",
    },
    "github": {
        "name": "GitHub", "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scopes": {"read": "read:user", "readwrite": "repo,read:user"},
        "client_id_key": "github_client_id", "client_secret_key": "github_client_secret",
    },
    "linear": {
        "name": "Linear", "auth_url": "https://linear.app/oauth/authorize",
        "token_url": "https://api.linear.app/oauth/token",
        "userinfo_url": "https://api.linear.app/graphql",
        "scopes": {"read": "read", "readwrite": "read,write"},
        "client_id_key": "linear_client_id", "client_secret_key": "linear_client_secret",
    },
    "dropbox": {
        "name": "Dropbox", "auth_url": "https://www.dropbox.com/oauth2/authorize",
        "token_url": "https://api.dropboxapi.com/oauth2/token",
        "userinfo_url": "https://api.dropboxapi.com/2/users/get_current_account",
        "scopes": {"read": "", "readwrite": ""},
        "client_id_key": "dropbox_client_id", "client_secret_key": "dropbox_client_secret",
    },
    "spotify": {
        "name": "Spotify", "auth_url": "https://accounts.spotify.com/authorize",
        "token_url": "https://accounts.spotify.com/api/token",
        "userinfo_url": "https://api.spotify.com/v1/me",
        "scopes": {"read": "user-read-email", "readwrite": "user-read-email,playlist-modify-public"},
        "client_id_key": "spotify_client_id", "client_secret_key": "spotify_client_secret",
    },
}


def _get_client_creds(provider: str) -> tuple[str, str]:
    cfg = PROVIDERS.get(provider, {})
    cid = getattr(settings, cfg.get("client_id_key", ""), "")
    csec = getattr(settings, cfg.get("client_secret_key", ""), "")
    return cid, csec


def _is_configured(provider: str) -> bool:
    cid, csec = _get_client_creds(provider)
    return bool(cid and csec)


# ── Provider listing ─────────────────────────────────────────────────


@router.get("/providers")
async def list_providers():
    return [
        {"id": pid, "name": p["name"], "configured": _is_configured(pid)}
        for pid, p in PROVIDERS.items()
    ]


# ── Connected integrations CRUD ──────────────────────────────────────


@router.get("/")
async def list_integrations(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Integration).where(Integration.user_id == user.id))
    rows = result.scalars().all()
    return [
        {
            "id": r.id, "provider": r.provider, "label": r.label, "permission": r.permission,
            "account_email": r.account_email, "account_name": r.account_name,
            "account_avatar": r.account_avatar, "is_active": r.is_active,
            "scope": r.scope, "connected_at": r.connected_at, "updated_at": r.updated_at,
        }
        for r in rows
    ]


@router.get("/{integration_id}")
async def get_integration(integration_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Integration).where(Integration.id == integration_id).limit(1))
    row = result.scalar_one_or_none()
    if not row or row.user_id != user.id:
        return {"error": "Not found"}, 404
    return {
        "id": row.id, "provider": row.provider, "label": row.label, "permission": row.permission,
        "account_email": row.account_email, "account_name": row.account_name,
        "is_active": row.is_active, "scope": row.scope,
    }


class IntegrationUpdate(BaseModel):
    label: str | None = None
    permission: str | None = None


@router.put("/{integration_id}")
async def update_integration(integration_id: int, body: IntegrationUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Integration).where(Integration.id == integration_id).limit(1))
    row = result.scalar_one_or_none()
    if not row or row.user_id != user.id:
        return {"error": "Not found"}, 404
    if body.label is not None:
        row.label = body.label
    if body.permission and body.permission in ("read", "readwrite"):
        row.permission = body.permission
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.delete("/{integration_id}")
async def delete_integration(integration_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Integration).where(Integration.id == integration_id).limit(1))
    row = result.scalar_one_or_none()
    if not row or row.user_id != user.id:
        return {"error": "Not found"}, 404
    await db.execute(delete(Integration).where(Integration.id == integration_id))
    await db.commit()
    return {"ok": True}


# ── Test connection ──────────────────────────────────────────────────

TEST_URLS = {
    "gmail": "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    "google-calendar": "https://www.googleapis.com/calendar/v3/calendars/primary",
    "google-drive": "https://www.googleapis.com/drive/v3/about?fields=user",
    "notion": "https://api.notion.com/v1/users/me",
    "dropbox": "https://api.dropboxapi.com/2/users/get_current_account",
    "linear": "https://api.linear.app/graphql",
    "github": "https://api.github.com/user",
    "spotify": "https://api.spotify.com/v1/me",
}


@router.post("/{integration_id}/test")
async def test_integration(integration_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Integration).where(Integration.id == integration_id).limit(1))
    row = result.scalar_one_or_none()
    if not row or row.user_id != user.id:
        return {"error": "Not found"}, 404
    if not row.access_token:
        return {"ok": False, "error": "No access token"}

    test_url = TEST_URLS.get(row.provider)
    if not test_url:
        return {"ok": False, "error": f"No test endpoint for {row.provider}"}

    try:
        headers = {"Authorization": f"Bearer {row.access_token}"}
        if row.provider == "notion":
            headers["Notion-Version"] = "2022-06-28"
        method = "POST" if row.provider in ("dropbox", "linear") else "GET"
        async with httpx.AsyncClient() as client:
            if row.provider == "linear":
                resp = await client.post(test_url, headers=headers, json={"query": "{ viewer { id } }"}, timeout=10)
            elif method == "POST":
                resp = await client.post(test_url, headers=headers, timeout=10)
            else:
                resp = await client.get(test_url, headers=headers, timeout=10)
            resp.raise_for_status()
        return {"ok": True, "provider": row.provider}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── OAuth flow ───────────────────────────────────────────────────────


@router.get("/{provider}/auth")
async def start_oauth(provider: str, permission: str = "readwrite"):
    if provider not in PROVIDERS or not _is_configured(provider):
        return {"error": f"{provider} is not configured"}, 400

    cfg = PROVIDERS[provider]
    cid, _ = _get_client_creds(provider)
    scope = cfg["scopes"].get(permission, cfg["scopes"]["readwrite"])
    callback = f"{settings.base_url}/api/integrations/{provider}/callback"

    import json
    import urllib.parse
    state = urllib.parse.quote(json.dumps({"permission": permission}))
    params = {
        "client_id": cid, "redirect_uri": callback, "response_type": "code",
        "scope": scope, "state": state, "access_type": "offline", "prompt": "consent",
    }
    url = cfg["auth_url"] + "?" + urllib.parse.urlencode(params)
    return RedirectResponse(url)


@router.get("/{provider}/callback")
async def oauth_callback(provider: str, code: str = "", state: str = "", error: str = "", user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if error:
        return HTMLResponse(f"<html><body><h2>Authorization failed</h2><p>{error}</p><script>window.close();</script></body></html>")
    if not code:
        return {"error": "No authorization code received"}, 400

    import json
    permission = "readwrite"
    try:
        st = json.loads(state)
        permission = st.get("permission", "readwrite")
    except Exception:
        pass

    cfg = PROVIDERS.get(provider, {})
    cid, csec = _get_client_creds(provider)
    callback = f"{settings.base_url}/api/integrations/{provider}/callback"

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(cfg["token_url"], data={
                "client_id": cid, "client_secret": csec, "code": code,
                "redirect_uri": callback, "grant_type": "authorization_code",
            }, headers={"Accept": "application/json"}, timeout=15)
            token_resp.raise_for_status()
            tokens = token_resp.json()

        access_token = tokens.get("access_token", "")
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in")
        scope = tokens.get("scope")

        # Fetch user info
        userinfo = {"email": None, "name": None, "avatar": None}
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            if provider == "notion":
                headers["Notion-Version"] = "2022-06-28"
            async with httpx.AsyncClient() as client:
                resp = await client.get(cfg.get("userinfo_url", ""), headers=headers, timeout=10)
                if resp.is_success:
                    data = resp.json()
                    userinfo["email"] = data.get("emailAddress") or data.get("email") or data.get("login")
                    userinfo["name"] = data.get("name") or data.get("display_name") or data.get("login")
                    userinfo["avatar"] = data.get("avatar_url") or data.get("profile_photo_url")
        except Exception:
            pass

        integration = Integration(
            user_id=user.id, provider=provider,
            label=userinfo["name"] or userinfo["email"] or provider,
            access_token=access_token, refresh_token=refresh_token,
            token_expires_at=datetime.now(timezone.utc).replace(microsecond=0) if not expires_in else datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + expires_in, tz=timezone.utc),
            scope=scope, permission=permission,
            account_email=userinfo["email"], account_name=userinfo["name"],
            account_avatar=userinfo["avatar"], is_active=True,
        )
        db.add(integration)
        await db.commit()
        await db.refresh(integration)

        return HTMLResponse(f"""<html><body>
<h2>Connected {provider}!</h2><p>You can close this window.</p>
<script>
if (window.opener) {{ window.opener.postMessage({{ type: 'integration-connected', provider: '{provider}', id: {integration.id} }}, '*'); window.close(); }}
else {{ setTimeout(() => window.location.href = '/', 2000); }}
</script></body></html>""")
    except Exception as e:
        return HTMLResponse(f"<html><body><h2>Connection failed</h2><p>{e}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>")


# ── Token-based connections (Notion, Airtable) ──────────────────────


class TokenConnect(BaseModel):
    token: str
    permission: str = "readwrite"


@router.post("/notion/connect")
async def connect_notion(body: TokenConnect, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.notion.com/v1/users/me",
                headers={"Authorization": f"Bearer {body.token}", "Notion-Version": "2022-06-28"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

        integration = Integration(
            user_id=user.id, provider="notion",
            label=data.get("name") or "Notion", access_token=body.token,
            permission=body.permission,
            account_name=data.get("name"), account_avatar=data.get("avatar_url"),
            is_active=True,
        )
        db.add(integration)
        await db.commit()
        await db.refresh(integration)
        return {"ok": True, "integration": {"id": integration.id, "provider": "notion", "account_name": data.get("name")}}
    except Exception as e:
        return {"error": str(e)}, 400


@router.post("/airtable/connect")
async def connect_airtable(body: TokenConnect, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.airtable.com/v0/meta/whoami",
                headers={"Authorization": f"Bearer {body.token}"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

        integration = Integration(
            user_id=user.id, provider="airtable",
            label=data.get("email") or "Airtable", access_token=body.token,
            permission=body.permission,
            account_email=data.get("email"), account_name=data.get("email"),
            is_active=True,
        )
        db.add(integration)
        await db.commit()
        await db.refresh(integration)
        return {"ok": True, "integration": {"id": integration.id, "provider": "airtable", "account_email": data.get("email")}}
    except Exception as e:
        return {"error": str(e)}, 400
