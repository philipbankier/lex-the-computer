"""Tests for the ChatService."""

from __future__ import annotations

import pytest

from app.services.chat_service import ChatService, _auto_title


class TestAutoTitle:
    def test_short_message(self):
        assert _auto_title("Hello world") == "Hello world"

    def test_long_message_truncates(self):
        msg = "This is a very long message that exceeds the fifty character limit for titles"
        title = _auto_title(msg)
        assert len(title) <= 51  # 50 + ellipsis
        assert title.endswith("\u2026")

    def test_multiline_takes_first_line(self):
        assert _auto_title("First line\nSecond line") == "First line"

    def test_strips_whitespace(self):
        assert _auto_title("  Hello  \n") == "Hello"

    def test_empty_message(self):
        assert _auto_title("") == ""


class TestChatService:
    async def test_create_conversation(self, mock_harness):
        service = ChatService(mock_harness)
        session = await service.create_conversation("Test Chat")
        assert session.title == "Test Chat"
        assert session.id

    async def test_create_conversation_no_title(self, mock_harness):
        service = ChatService(mock_harness)
        session = await service.create_conversation()
        assert session.title == "Test Chat"

    async def test_list_conversations(self, mock_harness):
        service = ChatService(mock_harness)
        await service.create_conversation("A")
        await service.create_conversation("B")
        convos = await service.list_conversations()
        assert len(convos) == 2

    async def test_get_conversation(self, mock_harness):
        service = ChatService(mock_harness)
        session = await service.create_conversation("Find Me")
        found = await service.get_conversation(session.id)
        assert found is not None
        assert found.title == "Find Me"

    async def test_get_conversation_not_found(self, mock_harness):
        service = ChatService(mock_harness)
        assert await service.get_conversation("nonexistent") is None

    async def test_delete_conversation_no_method(self, mock_harness):
        service = ChatService(mock_harness)
        assert await service.delete_conversation("any-id") is False

    async def test_send_message_streams(self, mock_harness):
        service = ChatService(mock_harness)
        session = await service.create_conversation("Chat")
        chunks = []
        async for chunk in service.send_message_stream("Hello", session.id):
            chunks.append(chunk)
        assert chunks[0].event == "start"
        assert chunks[-1].event == "end"
        tokens = [c for c in chunks if c.event == "token"]
        assert len(tokens) >= 1

    async def test_send_message_auto_creates_session(self, mock_harness):
        service = ChatService(mock_harness)
        conv_id, stream = await service.send_message("New chat message")
        assert conv_id  # Should have a UUID
        chunks = [c async for c in stream]
        assert len(chunks) >= 2  # start + end at minimum

    async def test_send_message_uses_existing_session(self, mock_harness):
        service = ChatService(mock_harness)
        session = await service.create_conversation("Existing")
        conv_id, stream = await service.send_message("Hi", conversation_id=session.id)
        assert conv_id == session.id
        # Consume stream
        _ = [c async for c in stream]
