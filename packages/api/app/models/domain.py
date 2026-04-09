from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class CustomDomain(Base):
    __tablename__ = "custom_domains"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    domain = Column(Text, nullable=False, unique=True)
    target_type = Column(String(16), nullable=False)  # 'site' | 'space' | 'service'
    target_id = Column(Integer)
    verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(Text)
    ssl_status = Column(String(16), default="pending", nullable=False)  # 'pending'|'active'|'error'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
