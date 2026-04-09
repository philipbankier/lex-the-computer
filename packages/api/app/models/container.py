from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class UserContainer(Base):
    __tablename__ = "user_containers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    container_id = Column(Text)
    status = Column(String(16), default="creating", nullable=False)
    hostname = Column(String(255))
    cpu_limit = Column(String(8), default="1", nullable=False)
    memory_limit = Column(String(8), default="2g", nullable=False)
    storage_limit = Column(String(8), default="10g", nullable=False)
    last_active_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
