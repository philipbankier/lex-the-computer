from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.sql import func

from app.database import Base


class SessionSearchIndex(Base):
    __tablename__ = "session_search_index"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_key = Column(String(255), nullable=False, index=True)
    title = Column(String(500))
    summary = Column(Text)
    search_vector = Column(TSVECTOR)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_session_search_index_search_vector", "search_vector", postgresql_using="gin"),
    )
