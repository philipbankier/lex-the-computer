from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, UserProfile

router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    social_links: dict | None = None
    language: str | None = None
    timezone: str | None = None
    share_location: bool | None = None


class AvatarUpdate(BaseModel):
    avatar: str


@router.get("/")
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id).limit(1))
    profile = result.scalar_one_or_none()
    return {
        "name": user.name,
        "bio": user.bio,
        "avatar": user.avatar,
        "social_links": profile.social_links if profile else {},
        "language": profile.language if profile else "",
        "timezone": profile.timezone if profile else "",
        "share_location": profile.share_location if profile else False,
    }


@router.patch("/")
async def update_profile(body: ProfileUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if body.name is not None:
        user.name = body.name
    if body.bio is not None:
        user.bio = body.bio

    if any(v is not None for v in [body.social_links, body.language, body.timezone, body.share_location]):
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id).limit(1))
        profile = result.scalar_one_or_none()
        if profile is None:
            profile = UserProfile(user_id=user.id)
            db.add(profile)
        if body.social_links is not None:
            profile.social_links = body.social_links
        if body.language is not None:
            profile.language = body.language
        if body.timezone is not None:
            profile.timezone = body.timezone
        if body.share_location is not None:
            profile.share_location = body.share_location
        profile.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return {"name": user.name, "bio": user.bio, "avatar": user.avatar}


@router.post("/avatar")
async def update_avatar(body: AvatarUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user.avatar = body.avatar
    await db.commit()
    return {"avatar": user.avatar}
