from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.content import SecretCreate
from app.services import secrets as secrets_svc

router = APIRouter(prefix="/api/secrets", tags=["secrets"])


@router.get("/")
async def list_secrets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await secrets_svc.list_secrets(db, user.id)
    return {"secrets": items}


@router.post("/")
async def create_secret(body: SecretCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key = body.key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="key required")
    await secrets_svc.create_secret(db, user.id, key, body.value)
    return {"ok": True}


@router.delete("/{key}")
async def delete_secret(key: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deleted = await secrets_svc.delete_secret(db, user.id, key)
    if not deleted:
        raise HTTPException(status_code=404, detail="Secret not found")
    return {"ok": True}
