from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text)
    type = Column(String(32), nullable=False)  # 'agent' | 'channel' | 'system'
    read = Column(Boolean, default=False, nullable=False)
    link = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
