import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.harness.factory import get_harness

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    try:
        harness = get_harness()
        harness_health = await harness.health_check()
    except Exception as e:
        logger.warning("Harness health check failed: %s", e)
        harness_health = {"status": "down", "gateway": f"error: {e}"}

    overall = "ok"
    if db_status != "ok" or harness_health.get("status") != "ok":
        overall = "degraded"

    return {
        "status": overall,
        "version": "2.0.0",
        "database": db_status,
        "harness": harness_health,
    }
