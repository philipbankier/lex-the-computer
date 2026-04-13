from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, email: str) -> User:
    user = User(email=email)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_or_create_user(db: AsyncSession, email: str) -> tuple[User, bool]:
    user = await get_user_by_email(db, email)
    if user is not None:
        return user, False
    user = await create_user(db, email)
    return user, True
