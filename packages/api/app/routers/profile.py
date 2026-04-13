from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.users import AvatarUpdate, ProfileUpdate
from app.services import profile as profile_svc

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/")
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await profile_svc.get_profile(db, user)


@router.patch("/")
async def update_profile_route(body: ProfileUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await profile_svc.update_profile(
        db,
        user,
        name=body.name,
        bio=body.bio,
        social_links=body.social_links,
        language=body.language,
        timezone_str=body.timezone,
        share_location=body.share_location,
    )


@router.post("/avatar")
async def update_avatar(body: AvatarUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    avatar = await profile_svc.update_avatar(db, user, body.avatar)
    return {"avatar": avatar}
