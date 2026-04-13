from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserProfile


async def get_profile(db: AsyncSession, user: User) -> dict:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id).limit(1)
    )
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


async def update_profile(
    db: AsyncSession,
    user: User,
    *,
    name: str | None = None,
    bio: str | None = None,
    social_links: dict | None = None,
    language: str | None = None,
    timezone_str: str | None = None,
    share_location: bool | None = None,
) -> dict:
    if name is not None:
        user.name = name
    if bio is not None:
        user.bio = bio

    profile_fields = [social_links, language, timezone_str, share_location]
    if any(v is not None for v in profile_fields):
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == user.id).limit(1)
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            profile = UserProfile(user_id=user.id)
            db.add(profile)
        if social_links is not None:
            profile.social_links = social_links
        if language is not None:
            profile.language = language
        if timezone_str is not None:
            profile.timezone = timezone_str
        if share_location is not None:
            profile.share_location = share_location
        profile.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return {"name": user.name, "bio": user.bio, "avatar": user.avatar}


async def update_avatar(db: AsyncSession, user: User, avatar: str) -> str:
    user.avatar = avatar
    await db.commit()
    return avatar
