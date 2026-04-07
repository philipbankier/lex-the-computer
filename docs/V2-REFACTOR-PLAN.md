# Lex the Computer — V2 Refactor Plan

**Date**: April 4, 2026 (Updated: April 6, 2026)
**Status**: PLANNING (do not implement until approved)
**Goal**: Refactor Lex to use OpenClaw as the default agent harness, migrate backend from Hono/Node.js to FastAPI/Python, and integrate Honcho as the default memory provider. Hermes Agent support is deferred until it reaches 1.0/PyPI stability.

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Target Architecture](#2-target-architecture)
3. [What Gets Deleted](#3-what-gets-deleted)
4. [What Gets Kept](#4-what-gets-kept)
5. [What Gets Created](#5-what-gets-created)
6. [Database Migration](#6-database-migration)
7. [OpenClaw Integration Details](#7-openclaw-integration-details)
8. [Honcho Memory Integration](#8-honcho-memory-integration)
9. [OpenClaw Onboarding Smoothing](#9-openclaw-onboarding-smoothing)
10. [Docker Compose Topology](#10-docker-compose-topology)
11. [Frontend Changes](#11-frontend-changes)
12. [Onboarding Flow Update](#12-onboarding-flow-update)
13. [Environment Variables](#13-environment-variables)
14. [Implementation Phases](#14-implementation-phases)
15. [Testing Strategy](#15-testing-strategy)
16. [Migration Path for Existing Users](#16-migration-path-for-existing-users)
17. [Future: Hermes Agent Support](#17-future-hermes-agent-support)

---

## 1. Current State

### Repository: `philipbankier/lex-the-computer`
- **17 commits** (12 phases + 2 remediations + Zo audit fixes + preview fixes)
- **Last commit**: `c28fe03` (preview fixes: email allowlist, onboarding flow)

### Current Package Structure
```
packages/
├── web/          # Next.js 16, React 19.2, Tailwind 4, shadcn/ui (KEEP)
├── core/         # Hono + TypeScript backend (REPLACE with FastAPI)
├── shared/       # Shared types (DELETE — no longer cross-language)
├── desktop/      # Tauri v2 (KEEP as-is for now)
```

### Current Backend Routes (packages/core/src/routes/)
33 route files total. Categorized by what happens to them:

**DELETE (agent harness handles these):**
- `chat.ts` — AI chat/streaming
- `automations.ts` — cron/scheduled AI tasks
- `channels.ts` — Telegram, Discord, SMS, Email plugins
- `channel-configs.ts` — per-channel model/persona config
- `mcp.ts` — MCP server
- `ai-providers.ts` — Claude Code, Codex, Gemini CLI detection
- `models.ts` — model listing/selection
- `personas.ts` — persona CRUD (harness handles this via workspace files)
- `rules.ts` — rule CRUD (harness handles this via workspace files)
- `browser.ts` — AI browser automation
- `ssh.ts` — SSH connectivity (harness terminal backends handle this)

**KEEP (product features, migrate to FastAPI):**
- `files.ts` — file browser CRUD
- `sites.ts` — hosted site management
- `services.ts` — service management
- `space.ts` — personal domain editor
- `datasets.ts` — DuckDB analytics
- `sell.ts` — Stripe Connect commerce
- `domains.ts` — custom domain management
- `admin.ts` — multi-user admin dashboard
- `system.ts` — server stats
- `terminal.ts` — web terminal (WebSocket → shell)
- `onboarding.ts` — onboarding wizard API
- `profile.ts` — user profile CRUD
- `settings.ts` — user settings
- `integrations.ts` — OAuth2 third-party connections
- `api-keys.ts` — API key management
- `public-api.ts` — public REST API (`/api/v1/ask`)
- `secrets.ts` — secret/env var management
- `skills.ts` — skills CRUD (filesystem, syncs with harness)
- `search.ts` — global search
- `notifications.ts` — notification center
- `bookmarks.ts` — bookmarked tabs/files
- `health.ts` — health check endpoints

### Current Database Tables (33 total)
Categorized by what happens:

**DELETE (harness owns these):**
- `conversations` — harness sessions replace this
- `messages` — harness session transcripts replace this
- `personas` — harness workspace files (SOUL.md patterns)
- `rules` — harness workspace files
- `agents` (automations table) — harness cron replaces this
- `agent_runs` — harness cron run history
- `channels` — harness gateway config
- `channel_messages` — harness message delivery
- `channel_configs` — harness per-channel config
- `ai_providers` — harness provider system
- `browser_sessions` — harness browser tool
- `ssh_keys` — harness terminal backends

**KEEP (migrate to SQLAlchemy):**
- `users` — user accounts
- `user_profiles` — extended profile (social links, language, timezone)
- `notifications` — in-app notifications
- `sites` — hosted sites
- `services` — hosted services
- `secrets` — environment secrets
- `datasets` — DuckDB dataset metadata
- `space_routes` — Space page/API routes
- `space_route_versions` — Space version history
- `space_assets` — Space uploaded assets
- `space_settings` — Space configuration
- `space_errors` — Space runtime errors
- `integrations` — OAuth2 connections
- `api_keys` — API keys for public API
- `skills` — skills index (syncs with filesystem)
- `skills_hub` — skills marketplace cache
- `custom_domains` — domain management
- `stripe_accounts` — Stripe Connect accounts
- `stripe_products` — products
- `stripe_prices` — prices
- `stripe_payment_links` — payment links
- `stripe_orders` — orders
- `user_containers` — multi-user containers
- `usage_records` — usage metering
- `bookmarks` — bookmarked items

### Current Tools (packages/core/src/tools/)
28 tool files. ALL get deleted — the harness provides all AI tools.

### Current Services (packages/core/src/services/)
**DELETE:**
- `automation-runner.ts` — harness cron
- `browser.ts` — harness browser tool
- `channels/` — all channel implementations (5 files)
- `prompt.ts` — harness prompt assembly
- `skill-loader.ts` — harness skills
- `seed-hub-skills.ts` — harness skills
- `ssh.ts` — harness terminal backends

**KEEP (migrate to Python):**
- `integrations/` — OAuth2 service modules (Gmail, Calendar, etc.)
- `media/` — fal.ai image/video, Groq transcription
- `site-runner.ts` → Python site runner
- `service-runner.ts` → Python service runner
- `container-manager.ts` → Python Docker management
- `stripe.ts` → Python Stripe service
- `usage.ts` → Python usage tracking

### Route Complexity Audit

Based on code analysis, routes are categorized by porting effort:

**Simple (<100 LOC, straightforward CRUD):** 9 routes
- `terminal.ts` (8 LOC, stub), `secrets.ts` (42), `settings.ts` (44), `bookmarks.ts` (39), `notifications.ts` (45), `profile.ts` (61), `search.ts` (60), `onboarding.ts` (94), `system.ts` (96)

**Medium (100-250 LOC, CRUD + some complexity):** 8 routes
- `services.ts` (78), `files.ts` (214), `datasets.ts` (150), `sites.ts` (144), `domains.ts` (156), `api-keys.ts` (121), `admin.ts` (178), `public-api.ts` (179)

**Complex (250+ LOC, multiple integrations):** 4 routes
- `integrations.ts` (299 — OAuth2 flows for 8+ providers)
- `skills.ts` (243 — filesystem scaffolding, hub integration)
- `space.ts` (379 — version history, code sandbox, HTML rendering)
- `sell.ts` (428 — Stripe Connect, webhooks, CSV export)

---

## 2. Target Architecture

```
┌──────────────────────────────────────────────────┐
│              Lex Web UI (Next.js 16)              │
│  packages/web — unchanged except API base URL     │
│  All pages stay: files, space, sell, themes, etc. │
├──────────────────────────────────────────────────┤
│         Lex Product API (FastAPI/Python)           │
│  packages/api — new Python package                │
│  Product routes only: files, sites, space,        │
│  datasets, commerce, admin, integrations, etc.    │
│  Delegates AI operations to the agent harness     │
├──────────────────────────────────────────────────┤
│          Agent Harness Abstraction Layer           │
│  packages/api/harness/base.py — ABC interface     │
│  packages/api/harness/openclaw.py — OpenClaw impl │
│  (packages/api/harness/hermes.py — future)        │
├──────────────────────────────────────────────────┤
│            OpenClaw Gateway (default)              │
│            Node.js, WebSocket sidecar              │
│            ws://openclaw:18789                     │
├──────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐   │
│  │       Honcho Memory (4 services)          │   │
│  │  honcho-api │ honcho-deriver │ redis      │   │
│  │  Dialectic user modeling, semantic search  │   │
│  └───────────────────────────────────────────┘   │
│  OR: Core memory (MEMORY.md/USER.md files only)   │
├──────────────────────────────────────────────────┤
│              Infrastructure                       │
│  PostgreSQL (shared: lex + honcho DBs) │ Caddy    │
└──────────────────────────────────────────────────┘
```

### Design Decisions (April 6, 2026)

1. **OpenClaw as default harness** — Production-proven (running daily), stable WS protocol, npm-installable. Hermes Agent (v0.7.0, not on PyPI, pre-1.0) deferred until stable.
2. **Single-user for V2** — No multi-tenancy. One OpenClaw instance per Lex deployment.
3. **Honcho requires 4 services** — api + deriver + postgres + redis. The deriver is mandatory for dialectic reasoning. Core memory offered as lightweight alternative.
4. **SSE streaming preserved** — FastAPI replicates exact `start`/`token`/`end` SSE format. Zero frontend changes.
5. **Skills sync via shared volume** — Lex writes skills to a shared Docker volume. OpenClaw reads via workspace mount.

---

## 3. What Gets Deleted

### From packages/core/ (entire package replaced)
The entire `packages/core/` directory is replaced by `packages/api/` (Python/FastAPI).

Specific deletions (functionality replaced by harness):
- All 28 tool files in `tools/`
- All channel services in `services/channels/`
- `services/automation-runner.ts`
- `services/browser.ts`
- `services/prompt.ts`
- `services/skill-loader.ts`
- `services/seed-hub-skills.ts`
- `services/ssh.ts`
- `routes/chat.ts`
- `routes/automations.ts`
- `routes/channels.ts`
- `routes/channel-configs.ts`
- `routes/mcp.ts`
- `routes/ai-providers.ts`
- `routes/models.ts`
- `routes/personas.ts`
- `routes/rules.ts`
- `routes/browser.ts`
- `routes/ssh.ts`
- `middleware/` (rate-limit and logging — reimplemented in FastAPI)
- `lib/env.ts` (reimplemented in Python)

### packages/shared/
Deleted entirely. With the backend now in Python, there's no shared TypeScript types package. Any shared contracts are defined in the FastAPI schemas.

### Database tables (12 tables deleted)
See list in Section 1. These are replaced by OpenClaw's own session/channel/automation storage (JSONL files + gateway config).

---

## 4. What Gets Kept

### packages/web/ (Next.js frontend)
**Entirely kept.** Only change: `NEXT_PUBLIC_CORE_URL` default changes from `http://localhost:3001` to `http://localhost:8000` (FastAPI port).

The frontend makes REST calls to the backend. The backend URL is the only thing that changes. All pages, components, and client-side logic remain.

### packages/desktop/ (Tauri v2)
**Kept as-is.** No changes needed for this phase.

### Product-layer routes (migrated to FastAPI)
22 route files migrated from TypeScript/Hono to Python/FastAPI. Each becomes a FastAPI router module.

### Product-layer services (migrated to Python)
- `integrations/` — all OAuth2 provider modules (Gmail, Calendar, Drive, Notion, Dropbox, Linear, GitHub, Airtable, Spotify, OneDrive, Google Tasks, Outlook)
- `media/` — fal.ai image/video generation, Groq Whisper transcription
- `site-runner.ts` → `site_runner.py`
- `service-runner.ts` → `service_runner.py`
- `container-manager.ts` → `container_manager.py`
- `stripe.ts` → `stripe_service.py`
- `usage.ts` → `usage_service.py`

### Database tables (21 tables kept)
See list in Section 1. Schema is migrated from Drizzle to SQLAlchemy models.

---

## 5. What Gets Created

### packages/api/ — New Python FastAPI Backend

```
packages/api/
├── pyproject.toml               # Python project config (uv/poetry)
├── alembic.ini                  # Database migration config
├── alembic/                     # Migration scripts
│   └── versions/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app entry + CORS + middleware
│   ├── config.py                # Environment config (pydantic-settings)
│   ├── database.py              # SQLAlchemy engine + session
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── site.py
│   │   ├── space.py
│   │   ├── dataset.py
│   │   ├── commerce.py          # Stripe tables
│   │   ├── integration.py
│   │   ├── skill.py
│   │   └── ...
│   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── site.py
│   │   └── ...
│   ├── routers/                 # FastAPI route modules
│   │   ├── __init__.py
│   │   ├── auth.py              # Signup/login (email allowlist in dev)
│   │   ├── files.py             # File browser CRUD
│   │   ├── sites.py             # Hosted sites management
│   │   ├── services.py          # Hosted services
│   │   ├── space.py             # Personal domain editor
│   │   ├── datasets.py          # DuckDB analytics
│   │   ├── sell.py              # Stripe commerce
│   │   ├── domains.py           # Custom domains
│   │   ├── admin.py             # Admin dashboard
│   │   ├── system.py            # Server stats
│   │   ├── terminal.py          # WebSocket terminal
│   │   ├── onboarding.py        # Onboarding wizard
│   │   ├── profile.py           # User profile
│   │   ├── settings.py          # User settings
│   │   ├── integrations.py      # OAuth2 connections
│   │   ├── api_keys.py          # API key management
│   │   ├── public_api.py        # Public REST API
│   │   ├── secrets.py           # Secrets/env vars
│   │   ├── skills.py            # Skills CRUD (syncs with harness)
│   │   ├── search.py            # Global search
│   │   ├── notifications.py     # Notification center
│   │   ├── bookmarks.py         # Bookmarks
│   │   ├── health.py            # Health checks
│   │   ├── chat.py              # Chat proxy → harness
│   │   └── automations.py       # Automations proxy → harness cron
│   ├── harness/                 # Agent harness abstraction
│   │   ├── __init__.py
│   │   ├── base.py              # ABC interface
│   │   └── openclaw.py          # OpenClaw implementation (default)
│   ├── services/                # Business logic
│   │   ├── __init__.py
│   │   ├── honcho_bridge.py     # Lex ↔ Honcho memory integration
│   │   ├── site_runner.py
│   │   ├── service_runner.py
│   │   ├── container_manager.py
│   │   ├── stripe_service.py
│   │   ├── usage_service.py
│   │   ├── integrations/        # OAuth2 provider modules
│   │   │   ├── gmail.py
│   │   │   ├── calendar.py
│   │   │   ├── drive.py
│   │   │   ├── notion.py
│   │   │   ├── dropbox.py
│   │   │   ├── linear.py
│   │   │   ├── github.py
│   │   │   ├── airtable.py
│   │   │   ├── spotify.py
│   │   │   ├── onedrive.py
│   │   │   ├── google_tasks.py
│   │   │   └── outlook.py
│   │   └── media/
│   │       ├── fal_image.py     # fal.ai image generation
│   │       ├── fal_video.py     # fal.ai video generation
│   │       └── transcription.py # Groq Whisper
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── auth.py              # Session cookie auth
│   │   ├── rate_limit.py
│   │   └── logging.py
│   └── utils/
│       ├── __init__.py
│       └── crypto.py            # Password hashing, token generation
├── docker/
│   └── init-db.sql              # Creates both 'lex' and 'honcho' databases
└── tests/
    └── ...
```

---

## 6. Database Migration

### Strategy
Use Alembic for database migrations. The schema is equivalent — just expressed in SQLAlchemy instead of Drizzle.

### Tables that get NEW columns
- `users` — add `memory_provider` (varchar, default 'honcho')

Note: `agent_harness` column removed — V2 is OpenClaw-only. Harness selection column can be added when Hermes support ships.

### Tables that are DELETED
The 12 harness-owned tables listed in Section 1. These are dropped via Alembic migration. OpenClaw manages its own storage (JSONL session files + gateway config).

### Postgres Init Script
A `docker/init-db.sql` script runs on first boot to create both databases:
```sql
CREATE DATABASE lex;
CREATE DATABASE honcho;
CREATE EXTENSION IF NOT EXISTS vector;
```

### SQLAlchemy Model Example (user.py)
```python
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    handle = Column(String(64))
    name = Column(String(255))
    bio = Column(Text)
    avatar = Column(Text)
    settings = Column(JSON)
    onboarding_completed = Column(Boolean, default=False, nullable=False)
    role = Column(String(16), default="user", nullable=False)
    is_disabled = Column(Boolean, default=False, nullable=False)
    memory_provider = Column(String(16), default="honcho", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

---

## 7. OpenClaw Integration Details

### Integration Mechanism
OpenClaw is Node.js, so it runs as a **sidecar process** in Docker. Lex communicates via WebSocket on `ws://openclaw:18789`.

```python
# packages/api/app/harness/openclaw.py
import websockets
import json

class OpenClawHarness(AgentHarness):
    def __init__(self, config: OpenClawConfig):
        self.ws_url = config.gateway_url  # ws://openclaw:18789
        self.token = config.gateway_token

    async def send_message(self, session_id, message, attachments=None):
        async with websockets.connect(self.ws_url) as ws:
            # Connect handshake
            await ws.send(json.dumps({
                "type": "req", "id": "1", "method": "connect",
                "params": {"auth": {"token": self.token}}
            }))
            await ws.recv()  # hello-ok

            # Send agent request
            await ws.send(json.dumps({
                "type": "req", "id": "2", "method": "agent",
                "params": {
                    "sessionKey": session_id,
                    "message": message,
                }
            }))

            # Stream responses
            async for msg in ws:
                data = json.loads(msg)
                if data.get("event") == "agent":
                    yield data["payload"]
                if data.get("type") == "res" and data.get("id") == "2":
                    break
```

### OpenClaw Docker Container
```yaml
openclaw:
  image: node:24-slim
  command: ["npx", "-y", "openclaw", "gateway"]
  volumes:
    - openclaw_data:/home/node/.openclaw
    - workspace:/data/workspace
  environment:
    - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
```

### What Lex Controls vs What OpenClaw Controls

| Concern | Owner |
|---------|-------|
| User authentication | Lex (FastAPI) |
| File storage/browsing | Lex (FastAPI) |
| AI chat/streaming | OpenClaw (gateway agent) |
| Tool execution | OpenClaw (tool system) |
| Tool approval policy | Lex (configures OpenClaw's `toolApproval` in openclaw.json) |
| Channels (Telegram, etc.) | OpenClaw (gateway) |
| Channel setup | Lex (onboarding writes openclaw.json channel config) |
| Skills | OpenClaw (runtime) — Lex provides UI, writes SKILL.md to shared volume |
| Memory (agent-side) | OpenClaw (MEMORY.md + local embeddings) |
| Memory (user modeling) | Lex ↔ Honcho bridge (injects user context into OpenClaw workspace) |
| MCP server | OpenClaw (built-in) |
| Cron/automations | OpenClaw (cron scheduler) — Lex provides UI |
| Model selection | OpenClaw (provider system) — Lex provides UI |
| Personas | OpenClaw (SOUL.md workspace files) — Lex provides UI |
| Integrations (Gmail etc.) | Lex (FastAPI OAuth2) — exposed as OpenClaw tools |
| Hosted sites | Lex (FastAPI) |
| Space editor | Lex (FastAPI) |
| Commerce | Lex (FastAPI + Stripe) |
| Admin/multi-user | Lex (FastAPI) — single-user for V2 |

### Skills Sync Mechanism

Lex and OpenClaw share a Docker volume mounted at `/data/workspace`. Skills are synced via the filesystem:

1. Lex UI writes/edits/deletes SKILL.md files in `/data/workspace/skills/`
2. OpenClaw reads skills from its workspace directory (configured in openclaw.json)
3. OpenClaw picks up changes automatically — no restart needed
4. The `skills.ts` → `skills.py` route handles the UI-side CRUD

---

## 8. Honcho Memory Integration

### Architecture
Honcho is integrated **directly by the Lex FastAPI backend** via the `honcho-ai` Python SDK. This is NOT a harness plugin — it's a Lex-level service that bridges Honcho's user modeling with OpenClaw's workspace files.

### How It Works

```python
# packages/api/app/services/honcho_bridge.py
from honcho import Honcho

class HonchoBridge:
    def __init__(self, config):
        self.honcho = Honcho(workspace_id=f"lex-{config.user_handle}")

    async def on_conversation_turn(self, user_message: str, assistant_response: str):
        """Called after each chat round-trip. Feeds the exchange to Honcho."""
        peer = self.honcho.peer(self.user_handle)
        session = self.honcho.session(self.session_id)
        session.add_messages([
            peer.message(user_message),
            self.honcho.peer("lex").message(assistant_response),
        ])

    async def get_user_context(self) -> str:
        """Query Honcho for user insights to inject into OpenClaw's system prompt."""
        peer = self.honcho.peer(self.user_handle)
        # Get dialectic user model summary
        insights = peer.chat("Summarize this user's preferences, communication style, and current focus areas.")
        return insights

    async def sync_to_workspace(self):
        """Write Honcho insights to OpenClaw's USER.md workspace file."""
        context = await self.get_user_context()
        workspace_path = Path(self.workspace_dir) / "USER.md"
        workspace_path.write_text(f"# User Profile (auto-updated by Honcho)\n\n{context}\n")
```

### Integration Flow
1. User sends message via chat UI
2. Lex FastAPI receives it, proxies to OpenClaw via harness
3. OpenClaw processes and returns response
4. Lex's Honcho bridge feeds the exchange to Honcho asynchronously (non-blocking)
5. Honcho's deriver builds/updates dialectic user model in background
6. Periodically (or on next turn), Lex queries Honcho for updated user insights
7. Insights are written to OpenClaw's `USER.md` workspace file
8. OpenClaw naturally includes `USER.md` in its system prompt on next conversation

This approach uses OpenClaw's existing workspace file pattern — no harness modifications needed.

### Docker Compose (Honcho — 4 services required)

Honcho requires **4 services** to function properly. The deriver is mandatory — without it, Honcho stores messages but never generates user models or insights.

```yaml
honcho-api:
  build:
    context: https://github.com/plastic-labs/honcho.git
  command: ["python", "-m", "src.main"]
  environment:
    - DB_CONNECTION_URI=postgresql+psycopg://postgres:postgres@postgres:5432/honcho
    - LLM_ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - AUTH_USE_AUTH=false
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy

honcho-deriver:
  build:
    context: https://github.com/plastic-labs/honcho.git
  command: ["python", "-m", "src.deriver"]
  environment:
    - DB_CONNECTION_URI=postgresql+psycopg://postgres:postgres@postgres:5432/honcho
    - LLM_ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - LLM_GEMINI_API_KEY=${GEMINI_API_KEY:-}
  depends_on:
    - honcho-api
```

**Note on Honcho LLM costs**: The deriver makes LLM API calls (Anthropic/Gemini) to generate dialectic user models. This is an ongoing cost that scales with conversation volume. Budget accordingly.

### What Honcho Provides
- **Dialectic user modeling** — builds evolving understanding of each user
- **Session context** — token-bounded summaries for conversation continuity
- **Semantic search** — find related past conversations
- **Peer representations** — per-session views of user state
- **Natural language query** — "What does this user prefer?" → structured answer

### Alternative Memory Providers (chosen during onboarding)
| Provider | Description | Requires |
|----------|-------------|----------|
| Honcho (default) | Dialectic user modeling, semantic search | Honcho services (4 containers) + LLM API key |
| Core (built-in) | MEMORY.md + USER.md files only | Nothing extra — OpenClaw handles natively |

Mem0 and OpenViking support can be added post-V2 if there's demand.

---

## 9. OpenClaw Onboarding Smoothing

During onboarding, Lex auto-configures OpenClaw so the user never touches config files.

### Auto-Generate openclaw.json

```python
# packages/api/app/services/openclaw_setup.py

def generate_openclaw_config(user, provider_config, telegram_config=None):
    """Generate openclaw.json from onboarding selections."""
    config = {
        "gateway": {
            "port": 18789,
            "token": secrets.token_urlsafe(32),
        },
        "agents": {
            "main": {
                "model": f"{provider_config['provider']}/{provider_config['model']}",
                "workspace": "/data/workspace",
                "toolApproval": "auto",
            }
        },
    }

    if telegram_config:
        config["channels"] = {
            "telegram": {
                "enabled": True,
                "botToken": telegram_config["bot_token"],
                "allowedUsers": [telegram_config["user_id"]],
            }
        }

    return config
```

### CLI Detection for AI Providers

```python
# During onboarding, detect available AI CLIs:
import shutil

providers_available = []
if shutil.which("claude"):
    providers_available.append({
        "id": "claude-cli",
        "name": "Claude (Max/Pro subscription)",
        "auth_method": "cli",
        "model_prefix": "claude-cli",
        "detected": True,
    })
if shutil.which("codex"):
    providers_available.append({
        "id": "codex-cli",
        "name": "OpenAI Codex (Plus/Pro subscription)",
        "auth_method": "device_code",
        "model_prefix": "codex-cli",
        "detected": True,
    })
if shutil.which("gemini"):
    providers_available.append({
        "id": "gemini-cli",
        "name": "Gemini CLI (free tier available)",
        "auth_method": "oauth",
        "model_prefix": "gemini-cli",
        "detected": True,
    })
# Always available:
providers_available.extend([
    {"id": "openrouter", "name": "OpenRouter (200+ models)", "model_prefix": "openrouter"},
    {"id": "byok", "name": "Bring your own API key", "model_prefix": "anthropic"},
])
```

### Telegram Auto-Setup
1. User enters Telegram bot token during onboarding
2. Lex writes it to `openclaw.json` channels config
3. OpenClaw gateway picks it up on next restart/reload
4. User gets confirmation in onboarding UI → bot is connected

### Tool Approval Policy
Lex configures OpenClaw to auto-approve workspace-scoped operations:
```json
{
  "agents": {
    "main": {
      "toolApproval": "auto"
    }
  }
}
```

---

## 10. Docker Compose Topology

```yaml
services:
  # --- Frontend ---
  web:
    build: ./packages/web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8000
    depends_on:
      - api

  # --- Product API (FastAPI) ---
  api:
    build: ./packages/api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lex
      - REDIS_URL=redis://redis:6379
      - OPENCLAW_GATEWAY_URL=ws://openclaw:18789
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - HONCHO_BASE_URL=http://honcho-api:8000
      - WORKSPACE_DIR=/data/workspace
      - FAL_KEY=${FAL_KEY}
      - GROQ_API_KEY=${GROQ_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    volumes:
      - workspace:/data/workspace
    depends_on:
      - postgres
      - redis
      - openclaw
      - honcho-api

  # --- Agent Harness (OpenClaw) ---
  openclaw:
    image: node:24-slim
    command: ["npx", "-y", "openclaw", "gateway"]
    environment:
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
    volumes:
      - openclaw_data:/home/node/.openclaw
      - workspace:/data/workspace

  # --- Memory Provider (Honcho) ---
  honcho-api:
    build:
      context: https://github.com/plastic-labs/honcho.git
    command: ["python", "-m", "src.main"]
    environment:
      - DB_CONNECTION_URI=postgresql+psycopg://postgres:postgres@postgres:5432/honcho
      - LLM_ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AUTH_USE_AUTH=false
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  honcho-deriver:
    build:
      context: https://github.com/plastic-labs/honcho.git
    command: ["python", "-m", "src.deriver"]
    environment:
      - DB_CONNECTION_URI=postgresql+psycopg://postgres:postgres@postgres:5432/honcho
      - LLM_ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LLM_GEMINI_API_KEY=${GEMINI_API_KEY:-}
    depends_on:
      - honcho-api

  # --- Infrastructure ---
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  workspace:
  openclaw_data:
  pg_data:
  redis_data:
  caddy_data:
```

**Total: 8 services** (web, api, openclaw, honcho-api, honcho-deriver, postgres, redis, caddy)

### Lite Mode (no Honcho)
For users who select "Core (built-in)" memory during onboarding, the `honcho-api` and `honcho-deriver` services can be excluded. A `docker-compose.lite.yml` override removes them:
```bash
# Full (with Honcho):
docker compose up

# Lite (Core memory only):
docker compose -f docker-compose.yml -f docker-compose.lite.yml up
```

---

## 11. Frontend Changes

### Minimal Changes Required
The frontend (`packages/web`) is almost entirely unchanged. The only modifications:

1. **API base URL**: `NEXT_PUBLIC_CORE_URL` default changes from `http://localhost:3001` to `http://localhost:8000`
2. **No streaming format changes** — the FastAPI chat proxy replicates the exact SSE format (`start`/`token`/`end` events)
3. **No other page changes** — all product pages (files, space, sell, etc.) call the same REST endpoints, just on a different port

### Chat Page Specifics
The chat page currently calls:
- `POST /api/chat/conversations` — create conversation
- `GET /api/chat/conversations` — list conversations
- `GET /api/chat/conversations/:id` — get conversation with messages
- `POST /api/chat/conversations/:id/messages` — send message (streaming response)

The FastAPI backend keeps these exact same endpoints but proxies them to OpenClaw:
```python
@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: int, body: SendMessageRequest):
    harness = get_harness()
    session_id = await map_conversation_to_session(conv_id)

    async def generate():
        yield f"event: start\ndata: {json.dumps({'model': harness.model})}\n\n"
        async for chunk in harness.send_message(session_id, body.content):
            yield f"event: token\ndata: {chunk}\n\n"
        msg = await save_assistant_message(conv_id, accumulated_response)
        yield f"event: end\ndata: {json.dumps({'messageId': msg.id})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

### Current Streaming Implementation (for reference)
- **Frontend**: `fetch()` + `ReadableStream` reader, manually parsing SSE frames
- **Backend**: Hono's `streamSSE()` with three event types: `start` (model info), `token` (raw text chunks), `end` (message ID)
- **LLM bridge**: OpenAI-compatible `/v1/chat/completions` with `stream: true`

The FastAPI replacement replicates this exactly. Zero frontend changes needed.

---

## 12. Onboarding Flow Update

### Updated Flow (V2 — simplified, no harness selection)
1. **Welcome** — "Welcome to Lex" + Get Started
2. **Profile** — Name, bio, interests, social links, timezone
3. **Memory Provider Selection**
   - "Honcho (recommended)" — dialectic user modeling, learns your preferences
   - "Core (built-in)" — simple file-based memory, no extra services
4. **AI Provider** — detect Claude/Codex/Gemini CLI, offer OpenRouter, BYOK
5. **Persona** — choose personality (writes SOUL.md to OpenClaw workspace)
6. **First Automation** — set up daily briefing etc. (writes OpenClaw cron job)
7. **Channels** — Telegram, Discord, Email (writes OpenClaw gateway config)
8. **Ready!** — Space URL, quick actions

Note: "Agent Harness Selection" step removed for V2 (OpenClaw only). Can be added back when Hermes support ships.

### Backend Logic for Onboarding
```python
@router.post("/onboarding/memory")
async def set_memory_provider(body: MemorySelection, user: User = Depends(get_current_user)):
    user.memory_provider = body.provider  # "honcho" or "core"
    db.commit()

    if body.provider == "honcho":
        # Verify Honcho services are reachable
        bridge = HonchoBridge(config=get_honcho_config(user))
        await bridge.verify_connection()

@router.post("/onboarding/provider")
async def set_ai_provider(body: ProviderSelection, user: User = Depends(get_current_user)):
    # Write provider config to openclaw.json
    openclaw_config = load_openclaw_config()
    openclaw_config["agents"]["main"]["model"] = f"{body.provider}/{body.model}"
    write_openclaw_config(openclaw_config)

@router.post("/onboarding/channels")
async def set_channels(body: ChannelSetup, user: User = Depends(get_current_user)):
    # Write channel config to openclaw.json
    openclaw_config = load_openclaw_config()
    if body.telegram_bot_token:
        openclaw_config["channels"] = {
            "telegram": {
                "enabled": True,
                "botToken": body.telegram_bot_token,
                "allowedUsers": [body.telegram_user_id],
            }
        }
    write_openclaw_config(openclaw_config)
```

---

## 13. Environment Variables

### Required (.env)
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lex
REDIS_URL=redis://redis:6379

# OpenClaw
OPENCLAW_GATEWAY_TOKEN=    # Auto-generated during first boot if empty
OPENCLAW_GATEWAY_URL=ws://openclaw:18789

# At least one AI provider (any of these):
ANTHROPIC_API_KEY=         # For Claude (also used by Honcho deriver)
OPENAI_API_KEY=            # For GPT/Codex
OPENROUTER_API_KEY=        # For OpenRouter (200+ models)
```

### Optional
```bash
# Honcho memory (required if using Honcho memory provider)
GEMINI_API_KEY=            # Used by Honcho deriver for summaries (optional, falls back to Anthropic)

# Media generation
FAL_KEY=                   # fal.ai image/video generation
GROQ_API_KEY=              # Groq Whisper transcription

# Commerce
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Channels (configured during onboarding, written to openclaw.json)
TELEGRAM_BOT_TOKEN=
DISCORD_BOT_TOKEN=

# Integrations
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
# ... etc for each OAuth provider

# Multi-user (not supported in V2, reserved for future)
# MULTI_USER=false
# ADMIN_EMAIL=admin@example.com
```

---

## 14. Implementation Phases

### Pre-requisite: Push Current State
- Commit `c28fe03` needs to be pushed to GitHub (Philip does this from his machine)
- Create `v2` branch from `master`

### Phase R1: Scaffold FastAPI Backend (2 days)
- Create `packages/api/` with FastAPI project structure
- Set up SQLAlchemy models (migrate 21 tables from Drizzle schema)
- Set up Alembic migrations
- Implement auth middleware (session cookie)
- Implement health check endpoint
- Create `docker/init-db.sql` for Postgres (creates `lex` + `honcho` databases)
- Verify: `docker compose up` boots API + Postgres + Redis
- **Acceptance**: `/health` returns 200, database connects, both databases exist

### Phase R2a: Migrate Simple + Medium Routes (3 days)
Port 17 routes from Hono/TypeScript to FastAPI/Python:

**Simple (9 routes, ~1h each):**
- `terminal.py`, `secrets.py`, `settings.py`, `bookmarks.py`, `notifications.py`, `profile.py`, `search.py`, `onboarding.py`, `system.py`

**Medium (8 routes, ~1.5h each):**
- `services.py`, `files.py`, `datasets.py`, `sites.py`, `domains.py`, `api_keys.py`, `admin.py`, `public_api.py`

- **Acceptance**: All 17 routes return expected responses, frontend pages load data

### Phase R2b: Migrate Complex Routes + Services (3 days)
Port 4 complex routes + all supporting services:

**Complex routes:**
- `sell.py` (428 LOC — Stripe Connect, webhooks, CSV export)
- `space.py` (379 LOC — version history, code sandbox, HTML rendering)
- `integrations.py` (299 LOC — OAuth2 flows for 8+ providers)
- `skills.py` (243 LOC — filesystem scaffolding, hub integration)

**Supporting services:**
- `container_manager.py` (202 LOC — Docker API)
- `integrations/` (1200+ LOC — 12 OAuth provider modules)
- `media/` (fal.ai, Groq transcription)
- `stripe_service.py`
- `site_runner.py`, `service_runner.py`
- `usage_service.py`

- **Acceptance**: All 22 routes functional, Stripe flow works, Space editor works, OAuth flows work

### Phase R3: Agent Harness Abstraction (1 day)
- Define `AgentHarness` abstract base class in `harness/base.py`
- Define all method signatures with type hints and docstrings
- Define `StreamChunk`, `Session`, `Automation`, `Skill` dataclasses
- **Acceptance**: Interface compiles, OpenClaw implementation can skeleton-implement it

### Phase R4: OpenClaw Integration (2 days)
- Implement `OpenClawHarness` class (WebSocket client)
- Add OpenClaw container to Docker Compose
- Wire chat routes through harness (with SSE format replication)
- Wire automations/cron through harness
- Wire skills listing through harness
- Configure tool auto-approval in openclaw.json
- Test: send a message via web UI → get AI response via OpenClaw
- **Acceptance**: Full chat round-trip works, tools execute, SSE streaming matches v1 format

### Phase R5: OpenClaw Onboarding Smoothing (1 day)
- Implement CLI detection for Claude/Codex/Gemini
- Implement auto-generation of openclaw.json from onboarding selections
- Implement Telegram gateway auto-config
- Implement provider setup (so onboarding can configure OpenClaw model)
- Test: complete onboarding → Telegram works → model selected
- **Acceptance**: New user can go from `docker compose up` → onboarding → working chat in <5 minutes

### Phase R6: Honcho Memory Bridge (2 days)
- Implement `honcho_bridge.py` service using `honcho-ai` Python SDK
- Wire bridge into chat flow (async feed after each turn)
- Implement periodic `USER.md` sync (write Honcho insights to OpenClaw workspace)
- Add Honcho services to Docker Compose (api + deriver + redis dependency)
- Implement memory provider selection in onboarding
- Verify Honcho builds from source in Docker (confirm image availability)
- Test: conversation → Honcho builds user model → USER.md updates → next conversation shows personalization
- **Acceptance**: Honcho API reachable, user model builds after conversations, Core memory works as fallback

### Phase R7: Session Search (1 day)
- Add `tsvector` column + GIN index on session-related data in Postgres
- Implement `/api/search/sessions` endpoint
- Wire into global search alongside OpenClaw's semantic memory search
- **Acceptance**: Keyword search returns relevant past conversations

### Phase R8: Update Frontend (1 day)
- Change `NEXT_PUBLIC_CORE_URL` default to `http://localhost:8000`
- Update onboarding page: remove harness selection, add memory provider step
- Update settings page to show current memory provider
- Verify all pages still work against FastAPI backend
- **Acceptance**: All pages load and function correctly

### Phase R9: Docker Compose & Docs (1 day)
- Finalize `docker-compose.yml` with all 8 services
- Create `docker-compose.lite.yml` override (excludes Honcho for Core memory users)
- Create `docker/init-db.sql`
- Update `README.md` with new quick start
- Update `SETUP.md` with full env var reference
- Create `.env.example`
- **Acceptance**: `docker compose up` from clean clone → working Lex instance

### Phase R10: Testing & Polish (2 days)
- End-to-end test: signup → onboarding → chat → files → automations → space
- Test Telegram channel via OpenClaw
- Test Stripe commerce flow
- Test Honcho memory pipeline (conversations → user model → personalization)
- Test Core memory fallback (no Honcho services)
- Test lite mode Docker Compose
- Fix any bugs
- **Acceptance**: Full QA pass, no broken features

### Timeline Summary

| Phase | Days | Cumulative |
|-------|------|-----------|
| R1: Scaffold | 2 | 2 |
| R2a: Simple + Medium Routes | 3 | 5 |
| R2b: Complex Routes + Services | 3 | 8 |
| R3: Harness Abstraction | 1 | 9 |
| R4: OpenClaw Integration | 2 | 11 |
| R5: Onboarding Smoothing | 1 | 12 |
| R6: Honcho Memory Bridge | 2 | 14 |
| R7: Session Search | 1 | 15 |
| R8: Frontend Updates | 1 | 16 |
| R9: Docker & Docs | 1 | 17 |
| R10: Testing & Polish | 2 | 19 |
| **Total** | **19 days** | |

Note: R3 can start in parallel with R2b (no dependency). R7 is optional and can be deferred post-V2 if needed.

---

## 15. Testing Strategy

### Unit Tests
- FastAPI route tests using `TestClient`
- Harness mock tests (test the abstraction works with mock OpenClaw)
- Database model tests
- Honcho bridge tests (mock Honcho SDK)

### Integration Tests
- Chat round-trip (FastAPI → OpenClaw → response)
- File operations (upload → browse → edit → delete)
- Onboarding flow (all steps, both memory providers)
- Stripe webhook handling
- Honcho pipeline (message → deriver → user model → USER.md sync)

### End-to-End
- Full user journey: signup → onboarding → chat → create site → sell product
- Channel test: Telegram message → AI response via OpenClaw
- Memory test: multi-turn conversation → verify personalization on return

---

## 16. Migration Path for Existing Users

Since Lex v1 has no real users yet (preview only), the migration is a clean cut:
- `master` branch preserves v1 (Hono/Node.js)
- `v2` branch is the refactor
- When v2 is stable, merge to master
- GitHub release tags mark the transition

Database: Alembic handles schema changes. Tables that are deleted were never populated with real data. Tables that are kept retain their data.

---

## 17. Future: Hermes Agent Support

Hermes Agent by NousResearch (v0.7.0 as of April 2026) is a promising agent framework with features OpenClaw doesn't have natively:
- **Learning loop** — skills auto-create and self-improve from experience
- **FTS5 session search** — built-in full-text search over past sessions
- **Terminal backends** — Docker, SSH, Daytona, Modal, Singularity
- **20+ model providers** — extensive provider system

### Why It's Deferred
1. **Not on PyPI** — install-from-source only, no `pip install hermes-agent`
2. **Pre-1.0** — v0.7.0, API surface is still changing
3. **Wrong API assumptions** — original plan's import paths (`hermes_agent.run_agent`, `hermes_agent.gateway.run`, `HermesState`) don't exist. Actual entry point is `from run_agent import AIAgent` with no gateway module.
4. **Multi-tenancy gap** — designed as single-user agent, requires Profiles feature (one process per user) for isolation

### When to Add
- Hermes reaches 1.0 or lands on PyPI with a stable API
- Implement `harness/hermes.py` against the real API surface
- Add harness selection to onboarding flow
- The `AgentHarness` ABC (Phase R3) is designed to make this a clean addition

### What Hermes Would Replace
When added, Hermes would handle: AI chat, tool execution, channels, skills, cron, MCP/ACP, session search, and memory (via its own Honcho plugin or built-in). The Lex ↔ Honcho bridge (Section 8) could be bypassed in favor of Hermes's native Honcho integration.

---

## Summary

| Metric | Before (v1) | After (v2) |
|--------|------------|------------|
| Backend language | TypeScript (Hono) | Python (FastAPI) |
| Agent engine | Custom (from scratch) | OpenClaw (production, battle-tested) |
| Channels | Custom (thin) | OpenClaw gateway (Telegram, Discord, etc.) |
| Memory | None | Honcho (dialectic modeling) OR Core (file-based) |
| Skills | Custom AgentSkills | OpenClaw AgentSkills (synced via shared volume) |
| Model providers | LiteLLM (limited) | OpenClaw provider system (Claude CLI, Codex CLI, OpenRouter, BYOK) |
| Session search | None | Postgres tsvector + OpenClaw semantic search |
| MCP/ACP | Custom | OpenClaw built-in |
| Docker Compose | 6 services | 8 services (web, api, openclaw, honcho-api, honcho-deriver, postgres, redis, caddy) |
| Docker Compose (lite) | — | 6 services (no Honcho) |
| Lines of custom code | ~15,000 (core) | ~5,000 (product API only) |
| Multi-user | Custom | Single-user (V2), multi-user deferred |
| Timeline | — | 19 days (10 phases) |
