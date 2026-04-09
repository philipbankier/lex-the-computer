import os
import platform
import subprocess
import sys

import psutil
from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/stats")
async def system_stats():
    cpu_percent = psutil.cpu_percent(interval=0.1)
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
    # Graceful restart — exit process; systemd/Docker will restart
    import asyncio

    async def _exit():
        await asyncio.sleep(0.5)
        sys.exit(0)

    asyncio.create_task(_exit())
    return {"ok": True, "message": "Restarting..."}


@router.post("/clear-cache")
async def clear_cache():
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.redis_url)
        await r.flushdb()
        await r.aclose()
        return {"ok": True, "message": "Cache cleared"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/logs")
async def get_logs():
    try:
        log_path = "/tmp/lex-api.log"
        if os.path.exists(log_path):
            with open(log_path) as f:
                lines = f.readlines()[-100:]
            return {"lines": [l.rstrip() for l in lines]}
    except Exception:
        pass
    return {"lines": ["Log collection not configured. Check container logs."]}
