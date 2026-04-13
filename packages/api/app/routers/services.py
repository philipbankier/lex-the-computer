from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.services import ServiceCreate, ServiceUpdate
from app.services import service_manager

router = APIRouter(prefix="/api/services", tags=["services"])


@router.post("/")
async def create_service(body: ServiceCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service_manager.create_service(
        db, user.id, name=body.name, type=body.type,
        entrypoint=body.entrypoint, port=body.port, env_vars=body.env_vars,
    )


@router.get("/")
async def list_services(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service_manager.list_services(db, user.id)


@router.get("/{service_id}")
async def get_service(service_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = await service_manager.get_service(db, user.id, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc


@router.patch("/{service_id}")
async def update_service(service_id: int, body: ServiceUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = await service_manager.update_service(
        db, user.id, service_id,
        name=body.name, entrypoint=body.entrypoint, port=body.port, env_vars=body.env_vars,
    )
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc


@router.delete("/{service_id}")
async def delete_service(service_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deleted = await service_manager.delete_service(db, user.id, service_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"ok": True}


@router.post("/{service_id}/start")
async def start_service(service_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = await service_manager.get_service(db, user.id, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    try:
        svc = await service_manager.start_service(db, svc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "status": "started", "port": svc.port}


@router.post("/{service_id}/stop")
async def stop_service(service_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = await service_manager.get_service(db, user.id, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    await service_manager.stop_service(db, svc)
    return {"ok": True, "status": "stopped"}


@router.post("/{service_id}/restart")
async def restart_service(service_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = await service_manager.get_service(db, user.id, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    svc = await service_manager.restart_service(db, svc)
    return {"ok": True, "status": "restarted", "port": svc.port}


@router.get("/{service_id}/logs")
async def get_service_logs(service_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = await service_manager.get_service(db, user.id, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    lines = service_manager.get_logs(service_id)
    return {"lines": lines}
