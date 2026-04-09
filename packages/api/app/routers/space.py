import mimetypes
from base64 import b64decode
from datetime import datetime, timezone
from html import escape as escape_html
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, Request, UploadFile, File
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.space import SpaceRoute, SpaceRouteVersion, SpaceAsset, SpaceSettings, SpaceError

router = APIRouter(prefix="/api/space", tags=["space"])

ASSETS_BASE = Path(settings.workspace_dir) / "space-assets"


# ── Routes CRUD ──────────────────────────────────────────────────────


class RouteCreate(BaseModel):
    path: str
    type: str = "page"
    code: str | None = None
    isPublic: bool = False


class RouteUpdate(BaseModel):
    path: str | None = None
    code: str | None = None
    isPublic: bool | None = None


@router.get("/routes")
async def list_routes(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceRoute).where(SpaceRoute.user_id == user.id))
    return result.scalars().all()


@router.post("/routes")
async def create_route(body: RouteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    route_path = body.path.strip()
    if not route_path:
        return {"error": "path required"}, 400
    route_type = "api" if body.type == "api" else "page"
    code = body.code or _default_code(route_type, route_path)
    is_public = True if route_type == "api" else body.isPublic

    route = SpaceRoute(user_id=user.id, path=route_path, type=route_type, code=code, is_public=is_public)
    db.add(route)
    await db.commit()
    await db.refresh(route)

    # Save initial version
    db.add(SpaceRouteVersion(route_id=route.id, code=code, version=1))
    await db.commit()
    return route


@router.get("/routes/{route_id}")
async def get_route(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceRoute).where(SpaceRoute.id == route_id).limit(1))
    route = result.scalar_one_or_none()
    if not route:
        return {"error": "not found"}, 404
    return route


@router.put("/routes/{route_id}")
async def update_route(route_id: int, body: RouteUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceRoute).where(SpaceRoute.id == route_id).limit(1))
    route = result.scalar_one_or_none()
    if not route:
        return {"error": "not found"}, 404

    old_code = route.code
    if body.code is not None:
        route.code = body.code
    if body.isPublic is not None:
        route.is_public = body.isPublic
    if body.path is not None:
        route.path = body.path
    route.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Auto-create version if code changed
    if body.code is not None and body.code != old_code:
        versions = (await db.execute(select(SpaceRouteVersion).where(SpaceRouteVersion.route_id == route_id))).scalars().all()
        max_ver = max((v.version for v in versions), default=0)
        db.add(SpaceRouteVersion(route_id=route_id, code=body.code, version=max_ver + 1))
        await db.commit()

    await db.refresh(route)
    return route


@router.delete("/routes/{route_id}")
async def delete_route(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(SpaceRouteVersion).where(SpaceRouteVersion.route_id == route_id))
    await db.execute(delete(SpaceError).where(SpaceError.route_id == route_id))
    await db.execute(delete(SpaceRoute).where(SpaceRoute.id == route_id))
    await db.commit()
    return {"ok": True}


# ── Version History / Undo / Redo ────────────────────────────────────


@router.get("/routes/{route_id}/history")
async def route_history(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SpaceRouteVersion).where(SpaceRouteVersion.route_id == route_id).order_by(SpaceRouteVersion.version)
    )
    return result.scalars().all()


@router.post("/routes/{route_id}/undo")
async def undo_route(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceRoute).where(SpaceRoute.id == route_id).limit(1))
    route = result.scalar_one_or_none()
    if not route:
        return {"error": "not found"}, 404

    versions = (await db.execute(
        select(SpaceRouteVersion).where(SpaceRouteVersion.route_id == route_id).order_by(SpaceRouteVersion.version)
    )).scalars().all()

    current_idx = next((i for i, v in enumerate(versions) if v.code == route.code), -1)
    if current_idx <= 0:
        return {"error": "nothing to undo"}, 400

    route.code = versions[current_idx - 1].code
    route.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(route)
    return route


@router.post("/routes/{route_id}/redo")
async def redo_route(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceRoute).where(SpaceRoute.id == route_id).limit(1))
    route = result.scalar_one_or_none()
    if not route:
        return {"error": "not found"}, 404

    versions = (await db.execute(
        select(SpaceRouteVersion).where(SpaceRouteVersion.route_id == route_id).order_by(SpaceRouteVersion.version)
    )).scalars().all()

    current_idx = next((i for i, v in enumerate(versions) if v.code == route.code), -1)
    if current_idx < 0 or current_idx >= len(versions) - 1:
        return {"error": "nothing to redo"}, 400

    route.code = versions[current_idx + 1].code
    route.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(route)
    return route


# ── Assets ───────────────────────────────────────────────────────────


class AssetBase64(BaseModel):
    filename: str
    content: str  # base64


@router.get("/assets")
async def list_assets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceAsset).where(SpaceAsset.user_id == user.id))
    return result.scalars().all()


@router.post("/assets")
async def upload_asset(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content_type = request.headers.get("content-type", "")
    ASSETS_BASE.mkdir(parents=True, exist_ok=True)

    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if not file or not hasattr(file, "read"):
            return {"error": "file required"}, 400
        filename = file.filename or "upload"
        data = await file.read()
        file_path = ASSETS_BASE / filename
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(data)
        mime = file.content_type or mimetypes.guess_type(filename)[0]
        asset = SpaceAsset(user_id=user.id, filename=filename, path=str(file_path), mime_type=mime, size=len(data))
        db.add(asset)
        await db.commit()
        await db.refresh(asset)
        return asset

    # JSON upload (base64)
    body = await request.json()
    filename = (body.get("filename") or "").strip()
    b64_content = body.get("content", "")
    if not filename or not b64_content:
        return {"error": "filename and content required"}, 400
    data = b64decode(b64_content)
    file_path = ASSETS_BASE / filename
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(data)
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    asset = SpaceAsset(user_id=user.id, filename=filename, path=str(file_path), mime_type=mime, size=len(data))
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceAsset).where(SpaceAsset.id == asset_id).limit(1))
    asset = result.scalar_one_or_none()
    if asset:
        Path(asset.path).unlink(missing_ok=True)
    await db.execute(delete(SpaceAsset).where(SpaceAsset.id == asset_id))
    await db.commit()
    return {"ok": True}


# ── Settings ─────────────────────────────────────────────────────────


class SpaceSettingsUpdate(BaseModel):
    handle: str | None = None
    title: str | None = None
    description: str | None = None
    favicon: str | None = None
    custom_css: str | None = None


@router.get("/settings")
async def get_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceSettings).where(SpaceSettings.user_id == user.id).limit(1))
    s = result.scalar_one_or_none()
    return s or {"handle": "", "title": "", "description": "", "favicon": "", "custom_css": ""}


@router.put("/settings")
async def update_settings(body: SpaceSettingsUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceSettings).where(SpaceSettings.user_id == user.id).limit(1))
    s = result.scalar_one_or_none()

    if s:
        for field in ["handle", "title", "description", "favicon", "custom_css"]:
            val = getattr(body, field, None)
            if val is not None:
                setattr(s, field, val)
        s.updated_at = datetime.now(timezone.utc)
    else:
        s = SpaceSettings(user_id=user.id, handle=body.handle or "", title=body.title, description=body.description, favicon=body.favicon, custom_css=body.custom_css)
        db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


# ── Errors ───────────────────────────────────────────────────────────


@router.get("/errors")
async def list_errors(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpaceError).order_by(SpaceError.created_at.desc()).limit(100))
    return result.scalars().all()


@router.delete("/errors")
async def clear_errors(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    routes = (await db.execute(select(SpaceRoute).where(SpaceRoute.user_id == user.id))).scalars().all()
    for r in routes:
        await db.execute(delete(SpaceError).where(SpaceError.route_id == r.id))
    await db.commit()
    return {"ok": True}


# ── Public Space Serving ─────────────────────────────────────────────


@router.get("/public/assets/{filename}")
async def serve_asset(filename: str):
    file_path = ASSETS_BASE / filename
    if not file_path.exists():
        return {"error": "not found"}, 404
    data = file_path.read_bytes()
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return Response(content=data, media_type=mime, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/public/{handle}/{path:path}")
async def serve_space(handle: str, path: str = "/", db: AsyncSession = Depends(get_db)):
    return await _serve_space(handle, "/" + path if path else "/", db)


@router.get("/public/{handle}")
async def serve_space_root(handle: str, db: AsyncSession = Depends(get_db)):
    return await _serve_space(handle, "/", db)


async def _serve_space(handle: str, route_path: str, db: AsyncSession) -> Response:
    result = await db.execute(select(SpaceSettings).where(SpaceSettings.handle == handle).limit(1))
    space_settings = result.scalar_one_or_none()
    if not space_settings:
        return Response(content='{"error":"space not found"}', status_code=404, media_type="application/json")

    routes = (await db.execute(select(SpaceRoute).where(SpaceRoute.user_id == space_settings.user_id))).scalars().all()
    normalized = route_path if route_path else "/"
    route = next((r for r in routes if r.path == normalized), None)
    if not route:
        return Response(content='{"error":"route not found"}', status_code=404, media_type="application/json")
    if not route.is_public:
        return Response(content='{"error":"not found"}', status_code=404, media_type="application/json")

    if route.type == "api":
        return Response(content='{"error":"API route execution not supported in V2 yet"}', status_code=501, media_type="application/json")

    return _render_page(route, space_settings)


def _render_page(route, space_settings) -> HTMLResponse:
    title = escape_html(space_settings.title or "Space")
    custom_css = space_settings.custom_css or ""
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>{custom_css}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
{route.code}

const _Component = typeof App !== 'undefined' ? App : (typeof Page !== 'undefined' ? Page : () => React.createElement('div', null, 'No component exported'));
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(_Component));
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)


# ── Helpers ──────────────────────────────────────────────────────────


def _default_code(route_type: str, route_path: str) -> str:
    if route_type == "api":
        return f'// API endpoint: {route_path}\nreturn {{ message: "Hello from {route_path}" }};'
    return """function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">My Page</h1>
        <p className="text-gray-400">Edit this page to get started</p>
      </div>
    </div>
  );
}"""
