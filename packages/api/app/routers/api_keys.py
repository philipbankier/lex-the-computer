from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.api_keys import KeyCreate, KeyUpdate
from app.services import api_keys as api_keys_svc

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


@router.get("/")
async def list_keys(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    keys = await api_keys_svc.list_keys(db, user.id)
    return [
        {
            "id": k.id, "name": k.name, "key_prefix": k.key_prefix,
            "last_used_at": k.last_used_at, "expires_at": k.expires_at,
            "is_active": k.is_active, "created_at": k.created_at,
        }
        for k in keys
    ]


@router.post("/")
async def create_key(body: KeyCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")

    key_obj, raw_key = await api_keys_svc.create_key(db, user.id, name, body.expires_in_days)
    return {
        "id": key_obj.id, "name": key_obj.name, "key": raw_key,
        "key_prefix": key_obj.key_prefix, "expires_at": key_obj.expires_at,
        "created_at": key_obj.created_at,
        "warning": "Save this key now. You will not be able to see it again.",
    }


@router.put("/{key_id}")
async def update_key(key_id: int, body: KeyUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key = await api_keys_svc.update_key(db, user.id, key_id, name=body.name, is_active=body.is_active)
    if key is None:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "key": {"id": key.id, "name": key.name, "is_active": key.is_active}}


@router.delete("/{key_id}")
async def revoke_key(key_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deleted = await api_keys_svc.delete_key(db, user.id, key_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


async def validate_api_key(key: str, db: AsyncSession) -> dict:
    if not key or not key.startswith("lex_"):
        return {"valid": False}
    ak = await api_keys_svc.validate_key(db, key)
    if ak is None:
        return {"valid": False}
    return {"valid": True, "user_id": ak.user_id}
