import base64
import hashlib
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.secret import Secret


def _encrypt_value(value: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", b"lex-secret-key", salt, 100_000)
    xored = bytes(a ^ b for a, b in zip(value.encode(), key[: len(value.encode())]))
    return base64.b64encode(salt + xored).decode()


async def list_secrets(db: AsyncSession, user_id: int) -> list[dict]:
    result = await db.execute(
        select(Secret).where(Secret.user_id == user_id).order_by(Secret.key)
    )
    return [{"id": s.id, "key": s.key, "created_at": s.created_at} for s in result.scalars()]


async def create_secret(db: AsyncSession, user_id: int, key: str, value: str) -> Secret:
    existing = await db.execute(
        select(Secret).where(Secret.user_id == user_id, Secret.key == key)
    )
    old = existing.scalar_one_or_none()
    if old:
        old.value_encrypted = _encrypt_value(value)
        await db.commit()
        await db.refresh(old)
        return old

    secret = Secret(user_id=user_id, key=key, value_encrypted=_encrypt_value(value))
    db.add(secret)
    await db.commit()
    await db.refresh(secret)
    return secret


async def delete_secret(db: AsyncSession, user_id: int, key: str) -> bool:
    result = await db.execute(
        select(Secret).where(Secret.user_id == user_id, Secret.key == key)
    )
    secret = result.scalar_one_or_none()
    if secret is None:
        return False
    await db.delete(secret)
    await db.commit()
    return True
