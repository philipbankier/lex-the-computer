from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.secret import Secret

router = APIRouter(prefix="/api/secrets", tags=["secrets"])


class SecretCreate(BaseModel):
    key: str
    value: str


@router.get("/")
async def list_secrets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Secret).where(Secret.user_id == user.id))
    rows = result.scalars().all()
    return {"secrets": [{"key": r.key, "created_at": r.created_at} for r in rows]}


@router.post("/")
async def create_secret(body: SecretCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key = body.key.strip()
    value = body.value.strip()
    if not key:
        return {"error": "key required"}, 400

    result = await db.execute(
        select(Secret).where(Secret.user_id == user.id, Secret.key == key).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.value_encrypted = value
    else:
        db.add(Secret(user_id=user.id, key=key, value_encrypted=value))
    await db.commit()
    return {"ok": True}


@router.delete("/{key}")
async def delete_secret(key: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Secret).where(Secret.user_id == user.id, Secret.key == key))
    await db.commit()
    return {"ok": True}
