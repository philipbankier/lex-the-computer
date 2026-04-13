import asyncio
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import terminal_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/terminal", tags=["terminal"])


@router.websocket("/ws")
async def terminal_ws(ws: WebSocket):
    await ws.accept()
    session_id = str(uuid.uuid4())

    try:
        init = await ws.receive_json()
        cols = init.get("cols", 80)
        rows = init.get("rows", 24)
    except Exception:
        cols, rows = 80, 24

    try:
        session = await terminal_manager.create_session(session_id, cols=cols, rows=rows)
    except Exception as e:
        logger.error("Failed to create terminal session: %s", e)
        await ws.send_json({"error": f"Failed to create terminal: {e}"})
        await ws.close()
        return

    async def read_loop():
        try:
            while True:
                data = await session.read()
                if not data:
                    break
                await ws.send_bytes(data)
        except (WebSocketDisconnect, Exception):
            pass

    read_task = asyncio.create_task(read_loop())

    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "bytes" in msg:
                await session.write(msg["bytes"])
            elif "text" in msg:
                import json
                try:
                    parsed = json.loads(msg["text"])
                    if parsed.get("type") == "resize":
                        await session.resize(parsed.get("cols", 80), parsed.get("rows", 24))
                    elif "data" in parsed:
                        await session.write(parsed["data"].encode())
                except (json.JSONDecodeError, ValueError):
                    await session.write(msg["text"].encode())
    except WebSocketDisconnect:
        pass
    finally:
        read_task.cancel()
        terminal_manager.destroy_session(session_id)
