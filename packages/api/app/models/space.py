from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class SpaceRoute(Base):
    __tablename__ = "space_routes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    path = Column(Text, nullable=False)
    type = Column(String(8), nullable=False)  # 'page' | 'api'
    code = Column(Text, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SpaceRouteVersion(Base):
    __tablename__ = "space_route_versions"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("space_routes.id"), nullable=False, index=True)
    code = Column(Text, nullable=False)
    version = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SpaceAsset(Base):
    __tablename__ = "space_assets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(Text, nullable=False)
    path = Column(Text, nullable=False)
    mime_type = Column(String(255))
    size = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SpaceSettings(Base):
    __tablename__ = "space_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    handle = Column(String(64))
    title = Column(String(255))
    description = Column(Text)
    favicon = Column(Text)
    custom_css = Column(Text)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SpaceError(Base):
    __tablename__ = "space_errors"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("space_routes.id"), nullable=False, index=True)
    error = Column(Text, nullable=False)
    stack = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
