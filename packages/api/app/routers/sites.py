from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.sites import SiteCreate, SiteFileWrite
from app.services import site_manager

router = APIRouter(prefix="/api/sites", tags=["sites"])


@router.post("/")
async def create_site(body: SiteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await site_manager.create_site(db, user.id, body.name, body.framework)


@router.get("/")
async def list_sites(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await site_manager.list_sites(db, user.id)


@router.get("/{site_id}")
async def get_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    site = await site_manager.get_site(db, user.id, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.delete("/{site_id}")
async def delete_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deleted = await site_manager.delete_site(db, user.id, site_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Site not found")
    return {"ok": True}


@router.post("/{site_id}/publish")
async def publish_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    site = await site_manager.get_site(db, user.id, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        site = await site_manager.publish_site(db, site)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "status": "published", "port": site.port}


@router.post("/{site_id}/unpublish")
async def unpublish_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    site = await site_manager.get_site(db, user.id, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    await site_manager.unpublish_site(db, site)
    return {"ok": True}


@router.post("/{site_id}/restart")
async def restart_site(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    site = await site_manager.get_site(db, user.id, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    await site_manager.restart_site(db, site)
    return {"ok": True, "status": "restarted"}


@router.get("/{site_id}/files")
async def list_site_files(site_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    site = await site_manager.get_site(db, user.id, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    files = site_manager.list_site_files(site.slug)
    return {"entries": files}


@router.get("/{site_id}/files/content")
async def read_site_file(site_id: int, path: str = Query(""), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    site = await site_manager.get_site(db, user.id, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        content = site_manager.read_site_file(site.slug, path)
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"path": path, "content": content}


@router.post("/{site_id}/files/content")
async def write_site_file(site_id: int, body: SiteFileWrite, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    site = await site_manager.get_site(db, user.id, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        site_manager.write_site_file(site.slug, body.path, body.content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}
