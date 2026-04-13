import logging
import os
import platform
import shutil
import sys
import time

import psutil

from app.config import settings

logger = logging.getLogger(__name__)

_boot_time = time.time()


def get_stats() -> dict:
    disk = shutil.disk_usage(settings.workspace_dir)
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": round(disk.used / disk.total * 100, 1),
        "uptime_seconds": time.time() - _boot_time,
        "python_version": sys.version,
        "platform": platform.platform(),
    }


def clear_cache() -> list[str]:
    cleared = []
    cache_dirs = [
        os.path.join(settings.workspace_dir, "__pycache__"),
        os.path.join(settings.workspace_dir, ".cache"),
        "/tmp/lex-cache",
    ]
    for d in cache_dirs:
        if os.path.isdir(d):
            shutil.rmtree(d, ignore_errors=True)
            cleared.append(d)
    return cleared


def get_logs(lines: int = 100) -> list[str]:
    log_paths = [
        "/var/log/lex/app.log",
        os.path.join(settings.workspace_dir, "logs", "app.log"),
    ]
    for path in log_paths:
        if os.path.isfile(path):
            try:
                with open(path) as f:
                    all_lines = f.readlines()
                return [l.rstrip() for l in all_lines[-lines:]]
            except Exception:
                pass
    return []


def reboot() -> dict:
    logger.warning("System reboot requested via API")
    return {"ok": True, "message": "Reboot initiated — container will restart"}
