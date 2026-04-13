"""Tests for the chat router."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import chat as chat_module
from app.routers.chat import router


@pytest.fixture
def chat_app(mock_harness):
    app = FastAPI()
    app.include_router(router)
    original = chat_module._harness
    chat_module._harness = mock_harness
    yield app
    chat_module._harness = original


class TestSendMessage:
    async def test_streams_sse_response(self, chat_app):
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/chat",
                json={"message": "Hello"},
            )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        assert "X-Conversation-Id" in resp.headers

        body = resp.text
        assert "event: start" in body
        assert "event: token" in body
        assert "event: end" in body

    async def test_returns_conversation_id(self, chat_app):
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/chat",
                json={"message": "Hello"},
            )
        conv_id = resp.headers["X-Conversation-Id"]
        assert conv_id  # non-empty UUID

    async def test_uses_existing_conversation(self, chat_app, mock_harness):
        session = await mock_harness.create_session("Existing")
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/chat",
                json={"message": "Hi", "conversation_id": session.id},
            )
        assert resp.status_code == 200
        assert resp.headers["X-Conversation-Id"] == session.id

    async def test_empty_message_returns_400(self, chat_app):
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/chat",
                json={"message": "   "},
            )
        assert resp.status_code == 400

    async def test_token_content(self, chat_app):
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/chat",
                json={"message": "Hello"},
            )
        body = resp.text
        lines = [l for l in body.split("\n") if l.startswith("data: ")]
        token_data = [l[6:] for l in lines if "Hello " in l or "world" in l]
        assert len(token_data) >= 1


class TestConversationEndpoints:
    async def test_create_conversation(self, chat_app):
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/chat/conversations",
                json={"title": "My Chat"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "My Chat"
        assert "id" in data
        assert "created_at" in data

    async def test_create_conversation_no_title(self, chat_app):
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/chat/conversations",
                json={},
            )
        assert resp.status_code == 200

    async def test_list_conversations(self, chat_app, mock_harness):
        await mock_harness.create_session("Chat 1")
        await mock_harness.create_session("Chat 2")
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/chat/conversations")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    async def test_get_conversation(self, chat_app, mock_harness):
        session = await mock_harness.create_session("Find Me")
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(f"/api/chat/conversations/{session.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Find Me"

    async def test_get_conversation_not_found(self, chat_app):
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/chat/conversations/nonexistent")
        assert resp.status_code == 404

    async def test_delete_conversation_not_found(self, chat_app):
        transport = ASGITransport(app=chat_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.delete("/api/chat/conversations/nonexistent")
        assert resp.status_code == 404
