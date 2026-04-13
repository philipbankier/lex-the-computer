import asyncio
import os
import platform
import sys

import psutil
from fastapi import APIRouter

from app.config import settings
from app.services import system_manager

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/stats")
async def system_stats():
    stats = system_manager.get_stats()
    cpu_percent = stats["cpu_percent"]
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    load_avg = os.getloadavg()

    return {
        "cpu": {
            "percent": cpu_percent,
            "cores": psutil.cpu_count(),
            "loadAvg": list(load_avg),
        },
        "memory": {
            "total": mem.total,
            "used": mem.used,
            "free": mem.available,
            "percent": mem.percent,
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "percent": disk.percent,
        },
        "uptime": int(psutil.boot_time()),
        "arch": platform.machine(),
        "platform": sys.platform,
        "hostname": platform.node(),
        "pythonVersion": platform.python_version(),
        "processCount": len(psutil.pids()),
    }


@router.post("/reboot")
async def reboot():
    result = system_manager.reboot()

    async def _exit():
        await asyncio.sleep(0.5)
        sys.exit(0)

    asyncio.create_task(_exit())
    return result


@router.post("/clear-cache")
async def clear_cache():
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.redis_url)
        await r.flushdb()
        await r.aclose()
        cleared = system_manager.clear_cache()
        return {"ok": True, "message": "Cache cleared", "cleared": cleared}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/logs")
async def get_logs():
    lines = system_manager.get_logs()
    if not lines:
        lines = ["Log collection not configured. Check container logs."]
    return {"lines": lines}
