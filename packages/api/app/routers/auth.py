from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.auth import AuthRequest
from app.services import auth as auth_svc

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup")
async def signup(body: AuthRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if settings.allowed_emails and body.email not in settings.allowed_emails:
        raise HTTPException(status_code=403, detail="Email not allowed")

    user, _created = await auth_svc.get_or_create_user(db, body.email)
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
    user = await auth_svc.get_user_by_email(db, body.email)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

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

    user = await auth_svc.get_user_by_email(db, email)
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
