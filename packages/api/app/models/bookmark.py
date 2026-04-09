from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(32), nullable=False)
    target_id = Column(Text)
    name = Column(String(255), nullable=False)
    href = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
