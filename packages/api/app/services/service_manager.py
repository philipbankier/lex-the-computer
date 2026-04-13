import asyncio
import logging
import os
import signal
from collections import deque
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.service import Service

logger = logging.getLogger(__name__)

_log_buffers: dict[int, deque] = {}
LOG_BUFFER_SIZE = 500


def _services_dir() -> Path:
    return Path(settings.workspace_dir) / "services"


async def list_services(db: AsyncSession, user_id: int) -> list[Service]:
    result = await db.execute(
        select(Service).where(Service.user_id == user_id).order_by(Service.created_at.desc())
    )
    return list(result.scalars().all())


async def get_service(db: AsyncSession, user_id: int, service_id: int) -> Service | None:
    result = await db.execute(
        select(Service).where(Service.id == service_id, Service.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_service(
    db: AsyncSession,
    user_id: int,
    *,
    name: str,
    type: str = "http",
    entrypoint: str | None = None,
    port: int | None = None,
    env_vars: dict | None = None,
) -> Service:
    svc_dir = _services_dir() / name.lower().replace(" ", "-")
    svc_dir.mkdir(parents=True, exist_ok=True)

    svc = Service(
        user_id=user_id,
        name=name,
        type=type,
        entrypoint=entrypoint or "index.ts",
        port=port,
        working_dir=str(svc_dir),
        env_vars=env_vars or {},
    )
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return svc


async def update_service(
    db: AsyncSession,
    user_id: int,
    service_id: int,
    *,
    name: str | None = None,
    entrypoint: str | None = None,
    port: int | None = None,
    env_vars: dict | None = None,
) -> Service | None:
    svc = await get_service(db, user_id, service_id)
    if svc is None:
        return None
    if name is not None:
        svc.name = name
    if entrypoint is not None:
        svc.entrypoint = entrypoint
    if port is not None:
        svc.port = port
    if env_vars is not None:
        svc.env_vars = env_vars
    await db.commit()
    await db.refresh(svc)
    return svc


async def delete_service(db: AsyncSession, user_id: int, service_id: int) -> bool:
    svc = await get_service(db, user_id, service_id)
    if svc is None:
        return False
    await stop_service(db, svc)
    await db.delete(svc)
    await db.commit()
    return True


async def start_service(db: AsyncSession, svc: Service) -> Service:
    if svc.is_running:
        return svc

    if not svc.working_dir or not svc.entrypoint:
        raise ValueError("Service missing working_dir or entrypoint")

    port = svc.port or _allocate_port()
    env = dict(os.environ)
    env.update(svc.env_vars or {})
    env["PORT"] = str(port)

    _log_buffers[svc.id] = deque(maxlen=LOG_BUFFER_SIZE)

    try:
        proc = await asyncio.create_subprocess_exec(
            "bun", "run", svc.entrypoint,
            cwd=svc.working_dir,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        asyncio.create_task(_capture_logs(svc.id, proc))
        svc.is_running = True
        svc.port = port
        await db.commit()
        await db.refresh(svc)
    except Exception as e:
        logger.error("Failed to start service %s: %s", svc.name, e)
        raise

    return svc


async def stop_service(db: AsyncSession, svc: Service) -> Service:
    if not svc.is_running:
        return svc

    if svc.port:
        _kill_by_port(svc.port)

    svc.is_running = False
    await db.commit()
    await db.refresh(svc)
    return svc


async def restart_service(db: AsyncSession, svc: Service) -> Service:
    await stop_service(db, svc)
    return await start_service(db, svc)


def get_logs(service_id: int, lines: int = 100) -> list[str]:
    buf = _log_buffers.get(service_id, deque())
    return list(buf)[-lines:]


async def _capture_logs(service_id: int, proc: asyncio.subprocess.Process) -> None:
    buf = _log_buffers.setdefault(service_id, deque(maxlen=LOG_BUFFER_SIZE))
    try:
        async for line in proc.stdout:
            buf.append(line.decode(errors="replace").rstrip())
    except Exception:
        pass


def _allocate_port() -> int:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


def _kill_by_port(port: int) -> None:
    try:
        import subprocess
        result = subprocess.run(
            ["fuser", f"{port}/tcp"], capture_output=True, text=True
        )
        for pid_str in result.stdout.split():
            pid_str = pid_str.strip()
            if pid_str.isdigit():
                os.kill(int(pid_str), signal.SIGTERM)
    except Exception:
        pass
