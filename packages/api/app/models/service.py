from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.database import Base


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(8), nullable=False)  # 'http' | 'tcp'
    port = Column(Integer)
    entrypoint = Column(Text)
    working_dir = Column(Text)
    env_vars = Column(JSONB)
    is_running = Column(Boolean, default=False, nullable=False)
    public_url = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
