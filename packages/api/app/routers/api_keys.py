import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.api_key import ApiKey

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> str:
    return f"lex_{secrets.token_urlsafe(32)}"


class KeyCreate(BaseModel):
    name: str
    expires_in_days: int | None = None


class KeyUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


@router.get("/")
async def list_keys(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.user_id == user.id))
    return [
        {
            "id": k.id, "name": k.name, "key_prefix": k.key_prefix,
            "last_used_at": k.last_used_at, "expires_at": k.expires_at,
            "is_active": k.is_active, "created_at": k.created_at,
        }
        for k in result.scalars().all()
    ]


@router.post("/")
async def create_key(body: KeyCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    if not name:
        return {"error": "name required"}, 400

    key = generate_api_key()
    key_hash = hash_key(key)
    key_prefix = key[:12] + "..."
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
        if body.expires_in_days
        else None
    )

    ak = ApiKey(
        user_id=user.id, name=name, key_hash=key_hash,
        key_prefix=key_prefix, expires_at=expires_at, is_active=True,
    )
    db.add(ak)
    await db.commit()
    await db.refresh(ak)
    return {
        "id": ak.id, "name": ak.name, "key": key,
        "key_prefix": key_prefix, "expires_at": ak.expires_at,
        "created_at": ak.created_at,
        "warning": "Save this key now. You will not be able to see it again.",
    }


@router.put("/{key_id}")
async def update_key(key_id: int, body: KeyUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id).limit(1))
    ak = result.scalar_one_or_none()
    if not ak or ak.user_id != user.id:
        return {"error": "Not found"}, 404
    if body.name is not None:
        ak.name = body.name
    if body.is_active is not None:
        ak.is_active = body.is_active
    await db.commit()
    return {"ok": True, "key": {"id": ak.id, "name": ak.name, "is_active": ak.is_active}}


@router.delete("/{key_id}")
async def revoke_key(key_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id).limit(1))
    ak = result.scalar_one_or_none()
    if not ak or ak.user_id != user.id:
        return {"error": "Not found"}, 404
    await db.execute(delete(ApiKey).where(ApiKey.id == key_id))
    await db.commit()
    return {"ok": True}


async def validate_api_key(key: str, db: AsyncSession) -> dict:
    """Validate an API key. Returns {"valid": True, "user_id": int} or {"valid": False}."""
    if not key or not key.startswith("lex_"):
        return {"valid": False}

    key_hash = hash_key(key)
    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash).limit(1))
    ak = result.scalar_one_or_none()
    if not ak or not ak.is_active:
        return {"valid": False}
    if ak.expires_at and ak.expires_at < datetime.now(timezone.utc):
        return {"valid": False}

    ak.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return {"valid": True, "user_id": ak.user_id}
