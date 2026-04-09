from fastapi import APIRouter

router = APIRouter(prefix="/api/terminal", tags=["terminal"])


@router.get("/ws")
async def terminal_ws():
    return {"error": "Terminal WebSocket not implemented in this build"}, 501
