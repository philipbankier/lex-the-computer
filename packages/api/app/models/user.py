from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    handle = Column(String(64))
    name = Column(String(255))
    bio = Column(Text)
    avatar = Column(Text)
    settings = Column(JSONB)
    onboarding_completed = Column(Boolean, default=False, nullable=False)
    role = Column(String(16), default="user", nullable=False)
    is_disabled = Column(Boolean, default=False, nullable=False)
    memory_provider = Column(String(16), default="honcho", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    display_name = Column(String(255))
    bio = Column(Text)
    interests = Column(JSONB)
    social_links = Column(JSONB)
    language = Column(String(64))
    timezone = Column(String(64))
    share_location = Column(Boolean, default=False)
    avatar_url = Column(Text)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
