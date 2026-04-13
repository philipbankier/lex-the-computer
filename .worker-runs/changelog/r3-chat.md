# R3 — Chat Proxy with SSE Streaming

## Summary
Chat router rewritten to use the harness factory (supports both Hermes and OpenClaw),
with a new `ChatService` business-logic layer and proper SSE streaming.

## New Files
- `packages/api/app/services/chat_service.py` — `ChatService` class: conversation CRUD,
  auto-title generation from first message, streaming delegation to harness.

## Modified Files
- `packages/api/app/routers/chat.py` — Replaced hardcoded `OpenClawHarness` with
  factory-based `get_harness()`. Added `POST /api/chat` as the primary send-message
  endpoint (SSE `StreamingResponse`). Added `DELETE /api/chat/conversations/{id}`.
  Fixed async-generator streaming bug (`await` removed — harness `send_message()` is
  an async generator, not a coroutine). Added error handling: 400 empty message,
  503 harness unavailable, SSE error event on stream failure.

## Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | Send message, stream SSE response |
| POST | `/api/chat/conversations` | Create conversation |
| GET | `/api/chat/conversations` | List conversations |
| GET | `/api/chat/conversations/{id}` | Get single conversation |
| DELETE | `/api/chat/conversations/{id}` | Delete conversation |

## SSE Format
```
event: start
data: {"model": "hermes"}

event: token
data: Hello

event: token
data:  world

event: end
data: {"messageId": 0}
```

## Key Decisions
- Harness singleton cached in module-level `_harness`; automations router continues
  to import `get_harness` from `chat.py` without changes.
- `ChatService.send_message()` auto-creates a conversation (with title from first
  message) when no `conversation_id` is provided.
- `X-Conversation-Id` response header lets the frontend learn the ID of auto-created
  conversations.
- `delete_conversation` uses `hasattr` check since `AgentHarness` ABC doesn't define
  `delete_session` yet — forward-compatible with future harness updates.
