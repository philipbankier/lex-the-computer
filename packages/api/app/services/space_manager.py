import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.space import SpaceAsset, SpaceError, SpaceRoute, SpaceRouteVersion, SpaceSettings

logger = logging.getLogger(__name__)


def _assets_dir() -> Path:
    d = Path(settings.workspace_dir) / "space" / "assets"
    d.mkdir(parents=True, exist_ok=True)
    return d


async def list_routes(db: AsyncSession, user_id: int) -> list[SpaceRoute]:
    result = await db.execute(
        select(SpaceRoute).where(SpaceRoute.user_id == user_id).order_by(SpaceRoute.path)
    )
    return list(result.scalars().all())


async def get_route(db: AsyncSession, user_id: int, route_id: int) -> SpaceRoute | None:
    result = await db.execute(
        select(SpaceRoute).where(SpaceRoute.id == route_id, SpaceRoute.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_route(
    db: AsyncSession, user_id: int, *, path: str, type: str = "page", code: str = "", is_public: bool = False
) -> SpaceRoute:
    route = SpaceRoute(user_id=user_id, path=path, type=type, code=code, is_public=is_public)
    db.add(route)
    await db.commit()
    await db.refresh(route)

    await _save_version(db, route)
    return route


async def update_route(
    db: AsyncSession, user_id: int, route_id: int, *, code: str | None = None, is_public: bool | None = None
) -> SpaceRoute | None:
    route = await get_route(db, user_id, route_id)
    if route is None:
        return None

    if code is not None:
        await _save_version(db, route)
        route.code = code
    if is_public is not None:
        route.is_public = is_public
    route.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(route)
    return route


async def delete_route(db: AsyncSession, user_id: int, route_id: int) -> bool:
    route = await get_route(db, user_id, route_id)
    if route is None:
        return False
    await db.delete(route)
    await db.commit()
    return True


async def _save_version(db: AsyncSession, route: SpaceRoute) -> SpaceRouteVersion:
    result = await db.execute(
        select(func.coalesce(func.max(SpaceRouteVersion.version), 0)).where(
            SpaceRouteVersion.route_id == route.id
        )
    )
    next_version = (result.scalar() or 0) + 1
    version = SpaceRouteVersion(route_id=route.id, code=route.code, version=next_version)
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


async def list_versions(db: AsyncSession, route_id: int) -> list[SpaceRouteVersion]:
    result = await db.execute(
        select(SpaceRouteVersion)
        .where(SpaceRouteVersion.route_id == route_id)
        .order_by(SpaceRouteVersion.version.desc())
    )
    return list(result.scalars().all())


async def undo_route(db: AsyncSession, user_id: int, route_id: int) -> SpaceRoute | None:
    route = await get_route(db, user_id, route_id)
    if route is None:
        return None
    versions = await list_versions(db, route_id)
    if len(versions) < 2:
        return route
    prev = versions[1]
    await _save_version(db, route)
    route.code = prev.code
    route.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(route)
    return route


async def redo_route(db: AsyncSession, user_id: int, route_id: int) -> SpaceRoute | None:
    route = await get_route(db, user_id, route_id)
    if route is None:
        return None
    versions = await list_versions(db, route_id)
    if not versions:
        return route
    latest = versions[0]
    route.code = latest.code
    route.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(route)
    return route


async def list_assets(db: AsyncSession, user_id: int) -> list[SpaceAsset]:
    result = await db.execute(
        select(SpaceAsset).where(SpaceAsset.user_id == user_id).order_by(SpaceAsset.created_at.desc())
    )
    return list(result.scalars().all())


async def upload_asset(
    db: AsyncSession, user_id: int, filename: str, data: bytes
) -> SpaceAsset:
    assets_dir = _assets_dir()
    file_path = assets_dir / filename
    file_path.write_bytes(data)

    mime, _ = mimetypes.guess_type(filename)
    asset = SpaceAsset(
        user_id=user_id,
        filename=filename,
        path=str(file_path),
        mime_type=mime or "application/octet-stream",
        size=len(data),
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def delete_asset(db: AsyncSession, user_id: int, asset_id: int) -> bool:
    result = await db.execute(
        select(SpaceAsset).where(SpaceAsset.id == asset_id, SpaceAsset.user_id == user_id)
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        return False
    file_path = Path(asset.path)
    if file_path.exists():
        file_path.unlink()
    await db.delete(asset)
    await db.commit()
    return True


async def get_settings(db: AsyncSession, user_id: int) -> SpaceSettings | None:
    result = await db.execute(
        select(SpaceSettings).where(SpaceSettings.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_settings(
    db: AsyncSession,
    user_id: int,
    *,
    handle: str | None = None,
    title: str | None = None,
    description: str | None = None,
    favicon: str | None = None,
    custom_css: str | None = None,
) -> SpaceSettings:
    result = await db.execute(
        select(SpaceSettings).where(SpaceSettings.user_id == user_id)
    )
    ss = result.scalar_one_or_none()
    if ss is None:
        ss = SpaceSettings(user_id=user_id)
        db.add(ss)
    if handle is not None:
        ss.handle = handle
    if title is not None:
        ss.title = title
    if description is not None:
        ss.description = description
    if favicon is not None:
        ss.favicon = favicon
    if custom_css is not None:
        ss.custom_css = custom_css
    ss.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ss)
    return ss


async def list_errors(db: AsyncSession, route_id: int, limit: int = 50) -> list[SpaceError]:
    result = await db.execute(
        select(SpaceError)
        .where(SpaceError.route_id == route_id)
        .order_by(SpaceError.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def log_error(db: AsyncSession, route_id: int, error: str, stack: str | None = None) -> SpaceError:
    err = SpaceError(route_id=route_id, error=error, stack=stack)
    db.add(err)
    await db.commit()
    await db.refresh(err)
    return err


async def resolve_public_route(db: AsyncSession, handle: str, path: str) -> SpaceRoute | None:
    ss_result = await db.execute(
        select(SpaceSettings).where(SpaceSettings.handle == handle)
    )
    ss = ss_result.scalar_one_or_none()
    if ss is None:
        return None

    normalized = "/" + path.lstrip("/") if path else "/"
    result = await db.execute(
        select(SpaceRoute).where(
            SpaceRoute.user_id == ss.user_id,
            SpaceRoute.path == normalized,
            SpaceRoute.is_public == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none()
