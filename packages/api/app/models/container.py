from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class UserContainer(Base):
    __tablename__ = "user_containers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    container_id = Column(Text)
    status = Column(String(32))
    hostname = Column(String(255))
    cpu_limit = Column(String(16))
    memory_limit = Column(String(16))
    storage_limit = Column(String(16))
    last_active_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
