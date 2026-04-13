"""
Chat router — SSE-streamed chat proxy to Hermes/OpenClaw harness.

Endpoints:
  POST   /api/chat                             send message (SSE stream)
  POST   /api/chat/conversations               create a new conversation
  GET    /api/chat/conversations               list all conversations
  GET    /api/chat/conversations/{conv_id}     get a single conversation
  DELETE /api/chat/conversations/{conv_id}     delete a conversation
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.harness import AgentHarness, get_harness as _factory_get_harness
from app.services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

# ---------------------------------------------------------------------------
# Harness singleton (also imported by automations router)
# ---------------------------------------------------------------------------

_harness: AgentHarness | None = None


def get_harness() -> AgentHarness:
    global _harness
    if _harness is None:
        _harness = _factory_get_harness()
    return _harness


def _get_service() -> ChatService:
    return ChatService(get_harness())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _session_dict(s) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
        "message_count": s.message_count,
    }


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class CreateConversationRequest(BaseModel):
    title: str | None = None


class SendMessageRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    attachments: list[dict] | None = None


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------


@router.post("")
async def send_message(body: SendMessageRequest):
    """Send a user message and stream the assistant response as SSE."""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message must not be empty")

    service = _get_service()

    try:
        conv_id, stream = await service.send_message(
            message=body.message,
            conversation_id=body.conversation_id,
            attachments=body.attachments,
        )
    except Exception as exc:
        logger.exception("Failed to initiate chat")
        raise HTTPException(
            status_code=503, detail="Agent harness unavailable"
        ) from exc

    async def event_stream():
        try:
            async for chunk in stream:
                data = (
                    chunk.data
                    if isinstance(chunk.data, str)
                    else json.dumps(chunk.data)
                )
                yield f"event: {chunk.event}\ndata: {data}\n\n"
        except Exception:
            logger.exception("Streaming error in conversation %s", conv_id)
            yield f"event: error\ndata: {json.dumps({'error': 'Stream interrupted'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "X-Conversation-Id": conv_id,
            "Cache-Control": "no-cache",
        },
    )


# ---------------------------------------------------------------------------
# Conversation management
# ---------------------------------------------------------------------------


@router.post("/conversations")
async def create_conversation(body: CreateConversationRequest):
    service = _get_service()
    session = await service.create_conversation(title=body.title)
    return _session_dict(session)


@router.get("/conversations")
async def list_conversations():
    service = _get_service()
    sessions = await service.list_conversations()
    return [_session_dict(s) for s in sessions]


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    service = _get_service()
    session = await service.get_conversation(conv_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _session_dict(session)


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str):
    service = _get_service()
    deleted = await service.delete_conversation(conv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True}
