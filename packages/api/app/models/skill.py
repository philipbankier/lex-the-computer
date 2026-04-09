from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    author = Column(String(255))
    version = Column(String(64))
    icon = Column(Text)
    directory = Column(Text)
    source = Column(String(16), default="local", nullable=False)  # 'local' | 'hub'
    hub_id = Column(Integer)
    is_active = Column(Boolean, default=True, nullable=False)
    installed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SkillsHub(Base):
    __tablename__ = "skills_hub"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    author = Column(String(255))
    version = Column(String(64))
    icon = Column(Text)
    tags = Column(Text)  # JSON array stored as text
    repo_url = Column(Text)
    download_url = Column(Text)
    downloads = Column(Integer, default=0, nullable=False)
    readme = Column(Text)
    skill_md = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
