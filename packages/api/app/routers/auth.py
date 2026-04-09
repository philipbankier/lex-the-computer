from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AuthRequest(BaseModel):
    email: str


@router.post("/signup")
async def signup(body: AuthRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if settings.allowed_emails and body.email not in settings.allowed_emails:
        return {"error": "Email not allowed"}, 403

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=body.email)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    response.set_cookie(
        key=settings.session_cookie_name,
        value=body.email,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return {"id": user.id, "email": user.email}


@router.post("/login")
async def login(body: AuthRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None:
        return {"error": "User not found"}, 404

    response.set_cookie(
        key=settings.session_cookie_name,
        value=body.email,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return {"id": user.id, "email": user.email}


@router.get("/session")
async def session_check(request: Request, db: AsyncSession = Depends(get_db)):
    email = request.cookies.get(settings.session_cookie_name)
    if not email:
        return {"authenticated": False}

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return {"authenticated": False}

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "handle": user.handle,
            "role": user.role,
            "onboarding_completed": user.onboarding_completed,
        },
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return {"ok": True}
