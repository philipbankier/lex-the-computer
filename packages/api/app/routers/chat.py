"""
Chat router — conversations and SSE-streamed message sending via OpenClawHarness.

Endpoints:
  POST   /api/chat/conversations              create a new conversation
  GET    /api/chat/conversations              list all conversations
  GET    /api/chat/conversations/{conv_id}   get a single conversation
  POST   /api/chat/conversations/{conv_id}/messages  send a message (SSE stream)
"""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.harness.base import HarnessConfig
from app.harness.openclaw import OpenClawHarness

router = APIRouter(prefix="/api/chat", tags=["chat"])

# ---------------------------------------------------------------------------
# Harness singleton
# ---------------------------------------------------------------------------

_harness: OpenClawHarness | None = None


def get_harness() -> OpenClawHarness:
    global _harness
    if _harness is None:
        config = HarnessConfig(
            gateway_url=settings.openclaw_gateway_url,
            gateway_token=settings.openclaw_gateway_token,
        )
        _harness = OpenClawHarness(config)
    return _harness


# ---------------------------------------------------------------------------
# Request/response schemas
# ---------------------------------------------------------------------------


class CreateConversationRequest(BaseModel):
    title: str | None = None


class SendMessageRequest(BaseModel):
    message: str
    attachments: list[dict] | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/conversations")
async def create_conversation(body: CreateConversationRequest):
    harness = get_harness()
    session = await harness.create_session(title=body.title)
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
        "message_count": session.message_count,
    }


@router.get("/conversations")
async def list_conversations():
    harness = get_harness()
    sessions = await harness.list_sessions()
    return [
        {
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
            "message_count": s.message_count,
        }
        for s in sessions
    ]


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str):
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


@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, body: SendMessageRequest):
    harness = get_harness()

    async def event_stream():
        async for chunk in await harness.send_message(
            session_id=conv_id,
            message=body.message,
            attachments=body.attachments,
        ):
            data = chunk.data if isinstance(chunk.data, str) else json.dumps(chunk.data)
            yield f"event: {chunk.event}\ndata: {data}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
