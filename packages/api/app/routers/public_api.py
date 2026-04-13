import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.api_keys import validate_api_key
from app.routers.chat import get_harness
from app.services import settings_manager

router = APIRouter(prefix="/api/v1", tags=["public-api"])


async def require_api_key(request: Request, db: AsyncSession = Depends(get_db)) -> int:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header. Use: Bearer <api_key>")
    key = auth[7:]
    result = await validate_api_key(key, db)
    if not result["valid"]:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    return result["user_id"]


class AskRequest(BaseModel):
    message: str
    model_name: str | None = None
    stream: bool = False
    conversation_id: str | None = None


@router.post("/ask")
async def ask(body: AskRequest, user_id: int = Depends(require_api_key)):
    harness = get_harness()

    if body.conversation_id:
        conv_id = body.conversation_id
    else:
        session = await harness.create_session(title="API request")
        conv_id = session.id

    if body.stream:
        async def event_stream():
            async for chunk in await harness.send_message(
                session_id=conv_id,
                message=body.message,
            ):
                data = chunk.data if isinstance(chunk.data, str) else json.dumps(chunk.data)
                yield f"event: {chunk.event}\ndata: {data}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    full_response = ""
    async for chunk in await harness.send_message(
        session_id=conv_id,
        message=body.message,
    ):
        if chunk.event == "text" and isinstance(chunk.data, str):
            full_response += chunk.data

    return {
        "response": full_response,
        "conversation_id": conv_id,
        "model": body.model_name,
    }


@router.get("/models/available")
async def list_models(user_id: int = Depends(require_api_key)):
    providers = settings_manager.list_providers()
    models = []
    for p in providers:
        if p["configured"]:
            for m in p["models"]:
                models.append({"id": f"{p['id']}/{m}", "provider": p["id"], "name": m})
    return {"data": models}


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user_id: int = Depends(require_api_key)):
    harness = get_harness()
    session = await harness.get_session(conv_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
        "message_count": session.message_count,
    }
