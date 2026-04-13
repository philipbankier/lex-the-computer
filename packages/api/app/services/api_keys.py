import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import ApiKey


def _generate_key() -> tuple[str, str, str]:
    raw = f"lex_{secrets.token_urlsafe(32)}"
    prefix = raw[:12]
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, prefix, key_hash


async def list_keys(db: AsyncSession, user_id: int) -> list[ApiKey]:
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
    )
    return list(result.scalars().all())


async def create_key(
    db: AsyncSession, user_id: int, name: str, expires_in_days: int | None = None
) -> tuple[ApiKey, str]:
    raw, prefix, key_hash = _generate_key()
    expires_at = None
    if expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    key = ApiKey(
        user_id=user_id,
        name=name,
        key_hash=key_hash,
        key_prefix=prefix,
        expires_at=expires_at,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return key, raw


async def update_key(
    db: AsyncSession, user_id: int, key_id: int, *, name: str | None = None, is_active: bool | None = None
) -> ApiKey | None:
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
    )
    key = result.scalar_one_or_none()
    if key is None:
        return None
    if name is not None:
        key.name = name
    if is_active is not None:
        key.is_active = is_active
    await db.commit()
    await db.refresh(key)
    return key


async def delete_key(db: AsyncSession, user_id: int, key_id: int) -> bool:
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
    )
    key = result.scalar_one_or_none()
    if key is None:
        return False
    await db.delete(key)
    await db.commit()
    return True


async def validate_key(db: AsyncSession, raw_key: str) -> ApiKey | None:
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)  # noqa: E712
    )
    key = result.scalar_one_or_none()
    if key is None:
        return None
    if key.expires_at and key.expires_at < datetime.now(timezone.utc):
        return None
    key.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return key
