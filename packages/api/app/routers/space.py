import mimetypes
from base64 import b64decode
from datetime import datetime, timezone
from html import escape as escape_html
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.space import SpaceError, SpaceRoute, SpaceRouteVersion
from app.models.user import User
from app.services import space_manager

router = APIRouter(prefix="/api/space", tags=["space"])

ASSETS_BASE = Path(settings.workspace_dir) / "space-assets"


class RouteCreate(BaseModel):
    path: str
    type: str = "page"
    code: str | None = None
    isPublic: bool = False


class RouteUpdate(BaseModel):
    path: str | None = None
    code: str | None = None
    isPublic: bool | None = None


class AssetBase64(BaseModel):
    filename: str
    content: str


class SpaceSettingsUpdate(BaseModel):
    handle: str | None = None
    title: str | None = None
    description: str | None = None
    favicon: str | None = None
    custom_css: str | None = None


@router.get("/routes")
async def list_routes(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await space_manager.list_routes(db, user.id)


@router.post("/routes")
async def create_route(body: RouteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    route_path = body.path.strip()
    if not route_path:
        raise HTTPException(status_code=400, detail="path required")
    route_type = "api" if body.type == "api" else "page"
    code = body.code or _default_code(route_type, route_path)
    is_public = True if route_type == "api" else body.isPublic

    return await space_manager.create_route(
        db, user.id, path=route_path, type=route_type, code=code, is_public=is_public,
    )


@router.get("/routes/{route_id}")
async def get_route(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    route = await space_manager.get_route(db, user.id, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.put("/routes/{route_id}")
async def update_route(route_id: int, body: RouteUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    route = await space_manager.get_route(db, user.id, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    old_code = route.code
    if body.code is not None:
        route.code = body.code
    if body.isPublic is not None:
        route.is_public = body.isPublic
    if body.path is not None:
        route.path = body.path
    route.updated_at = datetime.now(timezone.utc)
    await db.commit()

    if body.code is not None and body.code != old_code:
        versions = (await db.execute(
            select(SpaceRouteVersion).where(SpaceRouteVersion.route_id == route_id)
        )).scalars().all()
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


@router.get("/routes/{route_id}/history")
async def route_history(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await space_manager.list_versions(db, route_id)


@router.post("/routes/{route_id}/undo")
async def undo_route(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    route = await space_manager.undo_route(db, user.id, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.post("/routes/{route_id}/redo")
async def redo_route(route_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    route = await space_manager.redo_route(db, user.id, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.get("/assets")
async def list_assets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await space_manager.list_assets(db, user.id)


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
            raise HTTPException(status_code=400, detail="file required")
        data = await file.read()
        return await space_manager.upload_asset(db, user.id, file.filename or "upload", data)

    body = await request.json()
    filename = (body.get("filename") or "").strip()
    b64_content = body.get("content", "")
    if not filename or not b64_content:
        raise HTTPException(status_code=400, detail="filename and content required")
    data = b64decode(b64_content)
    return await space_manager.upload_asset(db, user.id, filename, data)


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deleted = await space_manager.delete_asset(db, user.id, asset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"ok": True}


@router.get("/settings")
async def get_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = await space_manager.get_settings(db, user.id)
    return s or {"handle": "", "title": "", "description": "", "favicon": "", "custom_css": ""}


@router.put("/settings")
async def update_settings(body: SpaceSettingsUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await space_manager.update_settings(
        db, user.id,
        handle=body.handle, title=body.title, description=body.description,
        favicon=body.favicon, custom_css=body.custom_css,
    )


@router.get("/errors")
async def list_errors(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    routes = await space_manager.list_routes(db, user.id)
    all_errors = []
    for r in routes:
        errors = await space_manager.list_errors(db, r.id)
        all_errors.extend(errors)
    return all_errors


@router.delete("/errors")
async def clear_errors(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    routes = await space_manager.list_routes(db, user.id)
    for r in routes:
        await db.execute(delete(SpaceError).where(SpaceError.route_id == r.id))
    await db.commit()
    return {"ok": True}


@router.get("/public/assets/{filename}")
async def serve_asset(filename: str):
    file_path = ASSETS_BASE / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Asset not found")
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
    route = await space_manager.resolve_public_route(db, handle, route_path)
    if not route:
        return Response(content='{"error":"route not found"}', status_code=404, media_type="application/json")

    if route.type == "api":
        return Response(content='{"error":"API route execution not supported in V2 yet"}', status_code=501, media_type="application/json")

    ss = await space_manager.get_settings(db, route.user_id)
    return _render_page(route, ss)


def _render_page(route, space_settings) -> HTMLResponse:
    title = escape_html((space_settings.title if space_settings else "") or "Space")
    custom_css = (space_settings.custom_css if space_settings else "") or ""
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
