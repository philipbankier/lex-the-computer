from pydantic import BaseModel


class SystemStats(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    uptime_seconds: float
    python_version: str
    platform: str


class RebootResponse(BaseModel):
    ok: bool = True
    message: str = "Reboot initiated"


class ClearCacheResponse(BaseModel):
    ok: bool = True
    cleared: list[str] = []
