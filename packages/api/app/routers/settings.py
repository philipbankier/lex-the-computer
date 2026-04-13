from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.secret import Secret
from app.models.user import User
from app.schemas.integrations import ProviderConfig
from app.services import settings_manager

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/providers")
async def list_providers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Secret).where(Secret.user_id == user.id))
    rows = result.scalars().all()
    keys = {r.key for r in rows}

    providers = settings_manager.list_providers()
    for p in providers:
        p["configured"] = f"provider:{p['id']}" in keys or p["configured"]
    return providers


@router.post("/providers")
async def set_provider(body: ProviderConfig, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key = f"provider:{body.provider}"
    result = await db.execute(
        select(Secret).where(Secret.user_id == user.id, Secret.key == key).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.value_encrypted = body.api_key
    else:
        db.add(Secret(user_id=user.id, key=key, value_encrypted=body.api_key))
    await db.commit()

    settings_manager.set_provider(body.provider, body.api_key, body.base_url, body.model)
    return {"ok": True}


@router.delete("/providers/{provider}")
async def delete_provider(provider: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key = f"provider:{provider}"
    await db.execute(delete(Secret).where(Secret.user_id == user.id, Secret.key == key))
    await db.commit()
    settings_manager.delete_provider(provider)
    return {"ok": True}
