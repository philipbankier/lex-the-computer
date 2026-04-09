from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(64), nullable=False)
    framework = Column(String(64))
    is_published = Column(Boolean, default=False, nullable=False)
    custom_domain = Column(String(255))
    port = Column(Integer)
    pid = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
