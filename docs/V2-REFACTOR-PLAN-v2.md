# Lex the Computer — V2 Refactor Plan (Updated)

**Date**: April 12, 2026
**Supersedes**: `docs/V2-REFACTOR-PLAN.md` (April 6, 2026)
**Status**: PLANNING — approved by Philip, ready for implementation
**Goal**: Refactor Lex to use **Hermes Agent as the default agent harness**, with OpenClaw as an alternative. Migrate backend from Hono/Node.js to FastAPI/Python. Integrate Honcho memory via Hermes's native plugin system.

---

## Table of Contents

1. [Why This Changed](#1-why-this-changed)
2. [Target Architecture](#2-target-architecture)
3. [What Gets Kept](#3-what-gets-kept)
4. [What Gets Deleted](#4-what-gets-deleted)
5. [What Gets Created](#5-what-gets-created)
6. [Hermes Agent Assessment](#6-hermes-agent-assessment)
7. [Hermes Quirks & Mitigations](#7-hermes-quirks--mitigations)
8. [Integration Design](#8-integration-design)
9. [Harness Abstraction Layer](#9-harness-abstraction-layer)
10. [Hermes Integration Details](#10-hermes-integration-details)
11. [OpenClaw Integration Details](#11-openclaw-integration-details)
12. [Memory: Honcho Default, Core Fallback](#12-memory-honcho-default-core-fallback)
13. [File Handling Strategy](#13-file-handling-strategy)
14. [Multi-User Strategy](#14-multi-user-strategy)
15. [Docker Compose Topology](#15-docker-compose-topology)
16. [Frontend Changes](#16-frontend-changes)
17. [Onboarding Flow](#17-onboarding-flow)
18. [Environment Variables](#18-environment-variables)
19. [Implementation Phases](#19-implementation-phases)
20. [Testing Strategy](#20-testing-strategy)
21. [Migration Path](#21-migration-path)
22. [Comparison: V1 Plan vs V2 Plan](#22-comparison-v1-plan-vs-v2-plan)

---

## 1. Why This Changed

The original V2 plan (April 6) defaulted to OpenClaw and deferred Hermes. Three things changed:

1. **Hermes v0.8.0 shipped (April 8)** with an OpenAI-compatible API server (`/v1/chat/completions` + `/v1/responses`). This eliminates the hardest integration problem — Lex just hits an HTTP endpoint instead of needing WebSocket IPC or subprocess hacks.

2. **Philip's hands-on experience** — running Hermes daily, prefers it over OpenClaw despite some quirks. The learning loop and memory plugins make the agent genuinely more useful over time.

3. **Research confirms Hermes is production-viable** — 64K GitHub stars, active development (100+ issues closed per week), Docker image available (`ghcr.io/nousresearch/hermes-agent:latest`), 15+ messaging platforms, 8 memory providers, 47 tools, bundled in Hostinger VPS catalog.

---

## 2. Target Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Lex Web UI (Next.js 16)               │
│    Chat, Files, Space, Sites, Sell, Themes, Admin         │
├──────────────────────────────────────────────────────────┤
│                  Lex Product API (FastAPI)                 │
│                                                           │
│  Product Routes (Lex owns):                               │
│  files, sites, services, datasets, sell, domains,         │
│  space, admin, secrets, settings, bookmarks, etc.         │
│                                                           │
│  Harness Proxy Layer:                                     │
│  chat → POST http://hermes:8642/v1/chat/completions       │
│  skills → GET/POST via Hermes tools API                   │
│  sessions → Hermes session search                         │
│  automations → Hermes cron                                │
├──────────────────────────────────────────────────────────┤
│            Agent Harness (swappable via config)            │
│                                                           │
│  ┌──────────────────────────┐  OR  ┌───────────────────┐ │
│  │   Hermes Agent (DEFAULT) │      │     OpenClaw      │ │
│  │   Python, API Server     │      │     Node.js, WS   │ │
│  │   Port 8642              │      │     Port 18789    │ │
│  │                          │      │                   │ │
│  │  ✅ Chat + streaming     │      │  ✅ Chat + stream │ │
│  │  ✅ 47 tools             │      │  ✅ Tools         │ │
│  │  ✅ 15+ channels         │      │  ✅ Channels      │ │
│  │  ✅ Honcho plugin        │      │  ✅ Memory        │ │
│  │  ✅ Learning loop        │      │  ✅ Multi-agent   │ │
│  │  ✅ Skills (AgentSkills) │      │  ✅ AgentSkills   │ │
│  │  ✅ FTS5 session search  │      │  ✅ Plugin system │ │
│  │  ✅ Cron                 │      │  ✅ Cron          │ │
│  │  ✅ MCP + ACP            │      │  ✅ MCP + ACP     │ │
│  │  ✅ 6 terminal backends  │      │                   │ │
│  └──────────────────────────┘      └───────────────────┘ │
├──────────────────────────────────────────────────────────┤
│                    Memory Layer                            │
│  ┌──────────┐ (Honcho — default)                          │
│  │ Honcho   │ Native Hermes plugin. Dialectic user model. │
│  │ via      │ 4-service sidecar. Zero custom bridge code. │
│  │ plugin   │                                               │
│  └──────────┘                                               │
│  ┌──────────┐ (Core — lite fallback)                       │
│  │ MEMORY.md│ Built-in Hermes memory. 2,200 char notes +  │
│  │ + USER.md│ 1,375 char user profile. No extra services. │
│  └──────────┘                                               │
├──────────────────────────────────────────────────────────┤
│                   Infrastructure                           │
│  PostgreSQL (pgvector) · Redis · Caddy                     │
└──────────────────────────────────────────────────────────┘
```

---

## 3. What Gets Kept

### Frontend (packages/web) — unchanged
- Entire Next.js 16 app with all UI pages
- Tab-based workspace, file browser, Monaco editor
- Space editor, Sites manager, Datasets explorer
- Sell dashboard, Admin panel, Settings, Themes
- Desktop app (packages/desktop) — Tauri v2, unchanged

### Product API (packages/api) — refactored from existing scaffold
All 22 routers stay. The routes and models on the `v2` branch are solid:

- `health`, `auth`, `profile`, `settings`, `bookmarks`, `notifications`
- `files`, `terminal`, `secrets`, `search`, `system`
- `sites`, `services`, `datasets`, `domains`, `api_keys`
- `sell` (Stripe Connect), `space` (page/API editor)
- `integrations` (OAuth2), `skills` (filesystem sync)
- `admin`, `public_api`, `onboarding`

### Database tables — kept (21 product tables)
- `users`, `user_profiles`, `notifications`
- `sites`, `services`, `secrets`, `datasets`
- `space_routes`, `space_route_versions`, `space_assets`, `space_settings`, `space_errors`
- `integrations`, `api_keys`, `skills`, `skills_hub`, `custom_domains`
- `bookmarks`, `usage`

---

## 4. What Gets Deleted

### From V1 (Hono/Node.js backend) — already removed on v2 branch
- `packages/core/` — entire Hono backend (replaced by FastAPI)
- `packages/shared/` — TypeScript shared types (no longer cross-language)

### Database tables deleted (agent harness owns these now)
- `conversations`, `messages` → Hermes sessions (SQLite + FTS5)
- `personas`, `rules` → Hermes SOUL.md + workspace files
- `agents`, `agent_runs` → Hermes cron jobs
- `channels`, `channel_messages`, `channel_configs` → Hermes gateway
- `ai_providers`, `browser_sessions`, `ssh_keys` → Hermes tools

### Custom code we DON'T need to write anymore
- ~~OpenClaw WebSocket client~~ → HTTP client to Hermes API
- ~~Custom Honcho bridge~~ → Native Hermes Honcho plugin
- ~~Custom session search~~ → Hermes FTS5 + session_search tool
- ~~Custom cron system~~ → Hermes built-in cron
- ~~Custom channel plugins~~ → Hermes 15+ platform adapters
- ~~Custom tool execution~~ → Hermes 47 tools

---

## 5. What Gets Created

### New files in packages/api/
```
app/
├── harness/
│   ├── base.py           # AgentHarness ABC
│   ├── hermes.py         # HermesHarness — HTTP client to Hermes API
│   ├── openclaw.py       # OpenClawHarness — WebSocket client (future)
│   └── factory.py        # get_harness() — reads config, returns instance
├── services/
│   ├── hermes_config.py  # Generates ~/.hermes/config.yaml + .env from onboarding
│   ├── hermes_setup.py   # Initializes Hermes profile, memory provider, tools
│   ├── stripe_service.py # Stripe Connect workflows
│   ├── site_runner.py    # Site process management
│   ├── service_runner.py # Service process management
│   ├── container_manager.py  # Docker-per-user option
│   ├── usage_service.py  # Usage metering
│   └── integrations/     # OAuth2 provider modules (8+ providers)
└── routers/
    └── chat.py           # NEW — proxies to harness, handles SSE streaming
```

### Docker files
```
docker/
├── init-db.sql                    # Creates lex + honcho databases
├── hermes/
│   ├── config.yaml                # Default Hermes config for Lex
│   └── Dockerfile.hermes          # Extends official Hermes image with Lex config
├── Dockerfile.api                 # FastAPI image
└── Dockerfile.web                 # Next.js image
```

---

## 6. Hermes Agent Assessment

### What Hermes Gives Us (out of the box, no custom code)
| Feature | Custom LOC Saved |
|---------|-----------------|
| AI chat + streaming (OpenAI-compatible API) | ~800 |
| 47 tools with approval system | ~2,000 |
| 15+ messaging channels (Telegram, Discord, Slack, WhatsApp, Signal, etc.) | ~1,500 |
| AgentSkills (same spec Lex uses) | ~400 |
| Memory: MEMORY.md + USER.md + 8 external providers | ~600 |
| FTS5 session search with LLM summarization | ~500 |
| Learning loop (auto skill creation + self-improvement) | Would need ~1,000+ custom |
| Cron scheduler with platform delivery | ~400 |
| MCP client + server | ~600 |
| ACP adapter (VS Code, Zed, JetBrains) | ~500 |
| 6 terminal backends (local, Docker, SSH, Daytona, Modal, Singularity) | ~800 |
| Context compression with lossy summarization | ~400 |
| Prompt caching (Anthropic) | ~200 |
| **Total custom LOC saved** | **~8,700** |

### What Hermes Doesn't Have (Lex must build)
- Web UI (that's our entire frontend)
- File browser / Monaco editor
- Space (personal domain editor)
- Sites & Services hosting
- Datasets (DuckDB analytics)
- Stripe Connect commerce
- Onboarding wizard
- Theme system
- Admin dashboard (beyond what Hermes Profiles give)
- Desktop app

---

## 7. Hermes Quirks & Mitigations

### Quirk 1: Aggressive Command Approval (78 dangerous patterns)
**Impact**: Agent constantly stops to ask permission for basic operations
**Mitigation**: Set `approvals.mode: off` in bundled Hermes config. Safe because:
- Lex runs Hermes inside Docker (container is the security boundary)
- Container backends skip approval checks by default in Hermes
- The Lex user already trusts their agent (they installed it)
- Users who want approval can switch to `smart` or `manual` in Settings

```yaml
# Lex's bundled hermes config
approvals:
  mode: off  # Container isolation is our security boundary
```

### Quirk 2: High Token Overhead (~19K baseline per request)
**Impact**: More expensive per conversation turn
**Mitigations**:
- Set `compression.threshold: 0.7` (compress earlier, default is 0.5)
- Only load needed skills (don't ship 40+ skills by default)
- Use Anthropic prompt caching (Hermes supports this natively)
- In our Docker setup, ensure Hermes runs from installed package, not repo directory (avoids dev context file loading)

### Quirk 3: No pip Package (install-from-source only)
**Impact**: Docker image build is slightly more complex
**Mitigation**: Use official Docker image `ghcr.io/nousresearch/hermes-agent:latest` as base. No install needed.

### Quirk 4: Approval System Bugs
- Issue #1888: "yes" to unrelated question approves pending command
- Issue #4542: agent doesn't resume after `/approve`
**Mitigation**: With `approvals.mode: off`, these bugs are irrelevant — no approval prompts at all.

### Quirk 5: SQLite state.db Corruption Under Heavy Use
**Impact**: Session search breaks, agent loses cross-session recall
**Mitigation**:
- Mount state.db on a Docker volume (not tmpfs)
- Add periodic backup of `~/.hermes/state.db` in Lex maintenance cron
- Report this upstream (it's a known issue, NousResearch is working on it)
- Long-term: consider contributing a PostgreSQL backend for session storage

### Quirk 6: Docker Image Runs as Root (Issue #3969)
**Impact**: Security concern for host if container escapes
**Mitigation**: Our Dockerfile extends the official image and adds:
```dockerfile
USER hermes:hermes
```
Plus Docker Compose security hardening (cap-drop, no-new-privileges, pids-limit).

### Quirk 7: No File Upload in API Server
**Impact**: Can't send files through chat API
**Mitigation**: Files go through Lex Product API (`POST /api/files`), stored on shared workspace volume. Agent reads files via its filesystem tools. See [Section 13](#13-file-handling-strategy).

### Quirk 8: 64K Context Window Minimum
**Impact**: Can't use small models
**Mitigation**: This is fine for Lex's target audience (using Claude, GPT, or large open models). Document in requirements.

---

## 8. Integration Design

### How Lex Talks to Hermes

```
Lex Frontend (browser)
    │
    ├── Chat message ──→ Lex API (/api/chat)
    │                       │
    │                       ├── Save to Lex DB? NO (Hermes owns sessions)
    │                       ├── Forward to Hermes API server
    │                       │   POST http://hermes:8642/v1/chat/completions
    │                       │   Authorization: Bearer <API_SERVER_KEY>
    │                       │   Body: { model: "hermes-agent", messages: [...], stream: true }
    │                       │
    │                       └── Stream SSE response back to frontend
    │                           (translate Hermes SSE → Lex SSE format)
    │
    ├── File upload ──→ Lex API (/api/files)
    │                       │
    │                       ├── Save to workspace volume
    │                       └── (optional) Inject hint message to Hermes:
    │                           POST http://hermes:8642/v1/chat/completions
    │                           "User uploaded report.pdf to /workspace/reports/"
    │
    ├── Skill management ──→ Hermes tools (via API)
    │   /api/skills         │   skills_list(), skill_view(), skill_manage()
    │                       │   Skills live on shared volume: ~/.hermes/skills/
    │
    ├── Automation/cron ──→ Hermes cron (via filesystem)
    │   /api/automations    │   Jobs stored in ~/.hermes/cron/jobs.json
    │                       │   Shared volume gives Lex API read/write access
    │
    └── Everything else ──→ Lex Product API (local)
        files, sites, sell, space, datasets, admin, etc.
        Pure product logic, no harness involvement
```

### SSE Streaming Translation

Hermes returns OpenAI-format SSE:
```
data: {"id":"chatcmpl-abc","choices":[{"delta":{"content":"Hello"}}]}
data: [DONE]
```

Lex frontend expects a consistent format. The harness proxy translates:

```python
# app/harness/hermes.py
async def stream_chat(self, messages: list[dict]) -> AsyncGenerator[str, None]:
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"{self.base_url}/v1/chat/completions",
            json={"model": "hermes-agent", "messages": messages, "stream": True},
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=120.0,
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    chunk = json.loads(line[6:])
                    delta = chunk["choices"][0].get("delta", {})
                    if content := delta.get("content"):
                        yield content
```

### Conversation State

Two approaches, we support both:

1. **Stateless (Chat Completions)**: Frontend sends full message history each time. Simpler but more token-expensive.
2. **Stateful (Responses API)**: Use `conversation` parameter for named conversations. Server stores state. More efficient.

Default: **Stateful via Responses API** with `conversation` namespacing.

```python
# Stateful conversation
POST /v1/responses
{
    "model": "hermes-agent",
    "conversation": "lex-user-{user_id}",
    "input": "What's in my project?",
    "store": true
}
```

---

## 9. Harness Abstraction Layer

```python
# app/harness/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncGenerator


@dataclass
class ChatMessage:
    role: str  # "user", "assistant", "system"
    content: str


@dataclass
class ChatResponse:
    content: str
    model: str
    usage: dict  # prompt_tokens, completion_tokens, total_tokens


@dataclass
class Automation:
    id: str
    name: str
    schedule: str  # cron expression
    prompt: str
    platform: str  # "telegram", "discord", etc.
    enabled: bool


@dataclass
class Skill:
    name: str
    description: str
    category: str


class AgentHarness(ABC):
    """Abstract base for agent harness integrations."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Harness identifier: 'hermes' or 'openclaw'"""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Is the harness running and healthy?"""
        ...

    @abstractmethod
    async def chat(self, messages: list[ChatMessage], **kwargs) -> ChatResponse:
        """Send messages, get response (non-streaming)."""
        ...

    @abstractmethod
    async def chat_stream(self, messages: list[ChatMessage], **kwargs) -> AsyncGenerator[str, None]:
        """Send messages, stream response tokens."""
        ...

    @abstractmethod
    async def list_skills(self) -> list[Skill]:
        """List available skills."""
        ...

    @abstractmethod
    async def list_automations(self) -> list[Automation]:
        """List scheduled automations/cron jobs."""
        ...

    @abstractmethod
    async def create_automation(self, automation: Automation) -> Automation:
        """Create a new automation."""
        ...

    @abstractmethod
    async def delete_automation(self, automation_id: str) -> bool:
        """Delete an automation."""
        ...

    @abstractmethod
    async def search_sessions(self, query: str, limit: int = 10) -> list[dict]:
        """Search past conversations."""
        ...

    @abstractmethod
    async def get_models(self) -> list[dict]:
        """List available AI models."""
        ...

    # Optional methods (override if supported)
    async def set_model(self, model: str) -> bool:
        return False

    async def get_memory_status(self) -> dict:
        return {}

    async def set_memory_provider(self, provider: str) -> bool:
        return False
```

```python
# app/harness/factory.py
from app.harness.base import AgentHarness
from app.config import settings


def get_harness() -> AgentHarness:
    if settings.AGENT_HARNESS == "hermes":
        from app.harness.hermes import HermesHarness
        return HermesHarness(
            base_url=settings.HERMES_API_URL,
            api_key=settings.HERMES_API_KEY,
        )
    elif settings.AGENT_HARNESS == "openclaw":
        from app.harness.openclaw import OpenClawHarness
        return OpenClawHarness(
            ws_url=settings.OPENCLAW_GATEWAY_URL,
            token=settings.OPENCLAW_GATEWAY_TOKEN,
        )
    else:
        raise ValueError(f"Unknown harness: {settings.AGENT_HARNESS}")
```

---

## 10. Hermes Integration Details

### HermesHarness Implementation

```python
# app/harness/hermes.py
import json
import httpx
from typing import AsyncGenerator

from app.harness.base import AgentHarness, ChatMessage, ChatResponse, Skill, Automation


class HermesHarness(AgentHarness):
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")  # http://hermes:8642
        self.api_key = api_key
        self._headers = {"Authorization": f"Bearer {api_key}"}

    @property
    def name(self) -> str:
        return "hermes"

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{self.base_url}/health", headers=self._headers, timeout=5.0)
                return r.status_code == 200
        except Exception:
            return False

    async def chat(self, messages: list[ChatMessage], **kwargs) -> ChatResponse:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/v1/chat/completions",
                headers={**self._headers, "Content-Type": "application/json"},
                json={
                    "model": kwargs.get("model", "hermes-agent"),
                    "messages": [{"role": m.role, "content": m.content} for m in messages],
                    "stream": False,
                },
                timeout=180.0,
            )
            r.raise_for_status()
            data = r.json()
            choice = data["choices"][0]
            return ChatResponse(
                content=choice["message"]["content"],
                model=data["model"],
                usage=data.get("usage", {}),
            )

    async def chat_stream(self, messages: list[ChatMessage], **kwargs) -> AsyncGenerator[str, None]:
        conversation = kwargs.get("conversation")
        payload = {
            "model": kwargs.get("model", "hermes-agent"),
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
        }
        # Use Responses API for stateful conversations
        if conversation:
            payload = {
                "model": kwargs.get("model", "hermes-agent"),
                "input": messages[-1].content,
                "conversation": conversation,
                "store": True,
            }
            endpoint = f"{self.base_url}/v1/responses"
        else:
            endpoint = f"{self.base_url}/v1/chat/completions"

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST", endpoint,
                headers={**self._headers, "Content-Type": "application/json"},
                json=payload,
                timeout=180.0,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    if line == "data: [DONE]":
                        break
                    try:
                        chunk = json.loads(line[6:])
                        if conversation:
                            # Responses API format
                            for output in chunk.get("output", []):
                                if output.get("type") == "message":
                                    for content in output.get("content", []):
                                        if text := content.get("text"):
                                            yield text
                        else:
                            # Chat Completions format
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            if content := delta.get("content"):
                                yield content
                    except json.JSONDecodeError:
                        continue

    async def list_skills(self) -> list[Skill]:
        # Skills live on shared volume, read directly
        # Or ask the agent via chat (meta, but works)
        # For now: scan ~/.hermes/skills/ on shared volume
        ...

    async def list_automations(self) -> list[Automation]:
        # Read ~/.hermes/cron/jobs.json from shared volume
        ...

    async def create_automation(self, automation: Automation) -> Automation:
        # Write to ~/.hermes/cron/jobs.json on shared volume
        # Hermes picks up changes automatically
        ...

    async def delete_automation(self, automation_id: str) -> bool:
        ...

    async def search_sessions(self, query: str, limit: int = 10) -> list[dict]:
        # Use Hermes agent to search: ask it via chat
        # Or directly query ~/.hermes/state.db SQLite (shared volume)
        ...

    async def get_models(self) -> list[dict]:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.base_url}/v1/models",
                headers=self._headers,
                timeout=10.0,
            )
            r.raise_for_status()
            return r.json().get("data", [])
```

### Hermes Config Generation

Lex onboarding generates a complete Hermes configuration:

```python
# app/services/hermes_config.py
import yaml
from pathlib import Path


def generate_hermes_config(
    model: str = "anthropic/claude-sonnet-4-6",
    api_key_env: dict = None,
    memory_provider: str = "honcho",  # "honcho" or "core"
    terminal_backend: str = "docker",
    channels: dict = None,
    approvals_mode: str = "off",
    workspace_dir: str = "/data/workspace",
) -> dict:
    """Generate Hermes config.yaml and .env from Lex onboarding selections."""

    config = {
        "model": model,
        "terminal": {
            "backend": terminal_backend,
            "cwd": workspace_dir,
            "timeout": 180,
        },
        "approvals": {
            "mode": approvals_mode,  # "off" for Lex default (Docker isolation)
        },
        "memory": {
            "memory_enabled": True,
            "user_profile_enabled": True,
        },
        "compression": {
            "threshold": 0.7,  # Compress earlier to save tokens
        },
        "api_server": {
            "enabled": True,
            "port": 8642,
            "host": "0.0.0.0",  # Accept connections from Lex API container
        },
    }

    # Memory provider
    if memory_provider == "honcho":
        config["memory"]["provider"] = "honcho"

    # Channels
    if channels:
        config["gateway"] = {}
        if channels.get("telegram"):
            config["gateway"]["telegram"] = {"enabled": True}
        if channels.get("discord"):
            config["gateway"]["discord"] = {"enabled": True}

    # Environment variables (secrets)
    env = {}
    if api_key_env:
        env.update(api_key_env)
    env["API_SERVER_ENABLED"] = "true"
    env["API_SERVER_KEY"] = "${HERMES_API_KEY}"

    return {"config.yaml": yaml.dump(config, default_flow_style=False), ".env": _format_env(env)}


def _format_env(env: dict) -> str:
    return "\n".join(f"{k}={v}" for k, v in env.items()) + "\n"
```

### Dockerfile for Hermes

```dockerfile
# docker/hermes/Dockerfile.hermes
FROM ghcr.io/nousresearch/hermes-agent:latest

# Copy Lex's default Hermes config
COPY docker/hermes/config.yaml /root/.hermes/config.yaml

# Create workspace mount point
RUN mkdir -p /data/workspace

# Expose API server port
EXPOSE 8642

# Start gateway (includes API server when API_SERVER_ENABLED=true)
CMD ["hermes", "gateway"]
```

---

## 11. OpenClaw Integration Details

OpenClaw remains a supported alternative harness. Implementation follows the same `AgentHarness` ABC but communicates via WebSocket instead of HTTP.

```python
# app/harness/openclaw.py (stub — implement when needed)
class OpenClawHarness(AgentHarness):
    """OpenClaw harness via WebSocket gateway."""

    @property
    def name(self) -> str:
        return "openclaw"

    async def health_check(self) -> bool:
        # GET http://openclaw:18789/health
        ...

    async def chat_stream(self, messages: list[ChatMessage], **kwargs) -> AsyncGenerator[str, None]:
        # WebSocket to ws://openclaw:18789 with session protocol
        ...
```

OpenClaw users swap one env var:
```bash
AGENT_HARNESS=openclaw
OPENCLAW_GATEWAY_URL=ws://openclaw:18789
OPENCLAW_GATEWAY_TOKEN=your-token
```

---

## 12. Memory: Honcho Default, Core Fallback

### Honcho (Default)
- Native Hermes plugin (`plugins/memory/honcho/`)
- 4-service sidecar: honcho-api, honcho-deriver, postgres, redis
- Dialectic user modeling — builds evolving model of the user over time
- Requires: `ANTHROPIC_API_KEY` (used by deriver for summaries)
- Setup: `hermes memory setup` → select Honcho → done

### Core (Lite Fallback)
- Built-in Hermes memory (MEMORY.md + USER.md)
- No extra services needed
- 2,200 char agent notes + 1,375 char user profile
- Automatic, no configuration

### User Choice
During onboarding, Step 4 asks:
> "Memory mode: **Deep** (recommended — agent builds a model of you over time) or **Light** (basic notes only)?"

- Deep → Honcho (full docker-compose.yml with 9 services)
- Light → Core (docker-compose.lite.yml with 6 services, no Honcho sidecars)

---

## 13. File Handling Strategy

### How Files Flow

```
User uploads file via Lex Web UI
    │
    ▼
Lex Product API: POST /api/files
    │
    ├── Validates file (size, type)
    ├── Saves to shared volume: /data/workspace/uploads/filename
    ├── Creates metadata record in Lex DB (files table)
    │
    └── (Optional) Notifies Hermes via shared workspace hint:
        │
        │   Option A: Passive (agent discovers on its own)
        │   Agent has terminal access to /data/workspace
        │   Agent can ls, read, analyze any file
        │
        │   Option B: Active notification (better UX)
        │   Inject a system message into next conversation turn:
        │   "User uploaded quarterly-report.pdf to /workspace/uploads/"
        │   Agent acknowledges and can reference the file
        │
        └── Both options work because /data/workspace is a shared volume
```

### Shared Volume Mount

Both Lex API and Hermes mount the same volume:

```yaml
volumes:
  - workspace:/data/workspace

# Lex API reads/writes product files (sites, services, uploads)
# Hermes agent reads/writes workspace files (terminal, file tools)
# Skills shared via: ~/.hermes/skills/ → also on workspace volume
```

---

## 14. Multi-User Strategy

### Default: Hermes Profiles (simple)

Each user gets an isolated Hermes profile:

```bash
hermes profile create user-123    # Separate config, memory, skills, sessions
hermes -p user-123 config set API_SERVER_PORT 8643
```

Each profile runs its own gateway process with its own API server port.

Lex API routes requests by user → correct Hermes profile port.

### Advanced: Docker-per-User (optional)

For heavier isolation (resource limits, full filesystem isolation):

```python
# app/services/container_manager.py
import docker

class ContainerManager:
    def create_user_container(self, user_id: str):
        """Spin up an isolated Hermes container per user."""
        client = docker.from_env()
        container = client.containers.run(
            "ghcr.io/nousresearch/hermes-agent:latest",
            name=f"lex-hermes-{user_id}",
            environment={...},
            volumes={...},
            cpu_count=1,
            mem_limit="2g",
            detach=True,
        )
        return container
```

### Config Choice
```yaml
# docker-compose.yml (default: profiles)
MULTI_USER_MODE=profiles

# docker-compose.advanced.yml (optional: containers)
MULTI_USER_MODE=containers
```

---

## 15. Docker Compose Topology

### Full Mode (with Honcho) — 9 services

```yaml
# docker-compose.yml
version: "3.9"

services:
  # --- Frontend ---
  web:
    build:
      context: .
      dockerfile: docker/hermes/Dockerfile.web  # Next.js
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      api:
        condition: service_healthy

  # --- Product API (FastAPI) ---
  api:
    build:
      context: .
      dockerfile: docker/hermes/Dockerfile.api
    ports:
      - "8000:8000"
    environment:
      - AGENT_HARNESS=hermes
      - HERMES_API_URL=http://hermes:8642
      - HERMES_API_KEY=${HERMES_API_KEY:-lex-local-dev}
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/lex
      - WORKSPACE_DIR=/data/workspace
    volumes:
      - workspace:/data/workspace
      - hermes_data:/root/.hermes  # Shared config read for skills/automations
    depends_on:
      postgres:
        condition: service_healthy
      hermes:
        condition: service_healthy

  # --- Agent Harness: Hermes (default) ---
  hermes:
    build:
      context: .
      dockerfile: docker/hermes/Dockerfile.hermes
    environment:
      - API_SERVER_ENABLED=true
      - API_SERVER_PORT=8642
      - API_SERVER_HOST=0.0.0.0
      - API_SERVER_KEY=${HERMES_API_KEY:-lex-local-dev}
    volumes:
      - workspace:/data/workspace
      - hermes_data:/root/.hermes
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8642/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # --- Memory: Honcho (4 services) ---
  honcho-api:
    build:
      context: https://github.com/plastic-labs/honcho.git
    command: ["python", "-m", "src.main"]
    environment:
      - DB_CONNECTION_URI=postgresql+psycopg://postgres:postgres@postgres:5432/honcho
      - LLM_ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - AUTH_USE_AUTH=false
    depends_on:
      postgres:
        condition: service_healthy

  honcho-deriver:
    build:
      context: https://github.com/plastic-labs/honcho.git
    command: ["python", "-m", "src.deriver"]
    environment:
      - DB_CONNECTION_URI=postgresql+psycopg://postgres:postgres@postgres:5432/honcho
      - LLM_ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - LLM_GEMINI_API_KEY=${GEMINI_API_KEY:-}
    depends_on:
      - honcho-api

  # --- Infrastructure ---
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: lex
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
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
      - ./deploy/caddy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web
      - api

volumes:
  workspace:
  hermes_data:
  pgdata:
  redisdata:
  caddy_data:
  caddy_config:
```

### Lite Mode (Core memory, no Honcho) — 6 services

```yaml
# docker-compose.lite.yml
# Override: removes honcho-api, honcho-deriver
# Hermes uses built-in Core memory (MEMORY.md + USER.md)
# Usage: docker compose -f docker-compose.yml -f docker-compose.lite.yml up
```

---

## 16. Frontend Changes

Minimal changes needed:

| Change | What |
|--------|------|
| API base URL | `NEXT_PUBLIC_API_URL` → `http://localhost:8000` (FastAPI, was Hono port) |
| Chat endpoint | `POST /api/chat` → proxy to Hermes via Lex API harness layer |
| SSE format | Translate Hermes OpenAI SSE → existing Lex streaming format |
| Onboarding | Add memory provider step (Deep/Light), update harness config |
| Settings | Show harness status (Hermes/OpenClaw), memory provider, model |
| Skills page | Read from shared volume instead of Lex DB |

### Chat Component Update

```typescript
// Before: talked to Lex core backend
const response = await fetch(`${API_URL}/chat`, { ... });

// After: talks to Lex API which proxies to Hermes
const response = await fetch(`${API_URL}/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify({
    message: input,
    conversation: `lex-user-${userId}`,  // Hermes stateful conversation
  }),
});
// Lex API → HermesHarness.chat_stream() → SSE back to frontend
```

---

## 17. Onboarding Flow

### 5-Step Wizard (updated for Hermes)

```
Step 1: Account
  - Create account (email + password)
  - OR single-user mode (no auth, skip to Step 2)

Step 2: AI Provider
  - "Which AI model do you want to use?"
  - Options: Claude (Anthropic), GPT (OpenAI), OpenRouter, Local (Ollama)
  - Enter API key
  - → Written to Hermes ~/.hermes/.env

Step 3: Memory Mode
  - "How should Lex remember you?"
  - Deep (recommended): Agent builds a rich model of you over time
    Requires Anthropic API key (for Honcho deriver)
  - Light: Basic notes only, no extra services
  - → Sets Hermes memory.provider = "honcho" or "core"

Step 4: Channels (optional)
  - "Connect Lex to your messaging apps"
  - Telegram: enter bot token + your user ID
  - Discord: enter bot token
  - → Written to Hermes ~/.hermes/.env and config.yaml

Step 5: Workspace
  - "Where should Lex store your files?"
  - Default: /data/workspace (Docker volume)
  - Custom path (advanced)
  - → Sets Hermes terminal.cwd and workspace mounts

→ Finish: Hermes starts with full config, user lands on dashboard
```

---

## 18. Environment Variables

### Required (.env)
```bash
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/lex

# Agent Harness
AGENT_HARNESS=hermes              # "hermes" or "openclaw"
HERMES_API_URL=http://hermes:8642
HERMES_API_KEY=lex-local-dev      # Bearer token for Hermes API server

# At least one AI provider (used by Hermes)
ANTHROPIC_API_KEY=                # Claude (also used by Honcho deriver)
# OR
OPENAI_API_KEY=                   # GPT
# OR
OPENROUTER_API_KEY=               # 200+ models
```

### Optional
```bash
# Memory
GEMINI_API_KEY=                   # Honcho deriver (optional, falls back to Anthropic)

# Media
FAL_KEY=                          # fal.ai image/video generation
GROQ_API_KEY=                     # Groq Whisper transcription

# Commerce
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Channels (configured during onboarding)
TELEGRAM_BOT_TOKEN=
DISCORD_BOT_TOKEN=

# OpenClaw (only if AGENT_HARNESS=openclaw)
OPENCLAW_GATEWAY_URL=ws://openclaw:18789
OPENCLAW_GATEWAY_TOKEN=
```

---

## 19. Implementation Phases

### Phase R1: Scaffold + Hermes Docker (2 days)
- Refactor existing `packages/api/` scaffold
- Create `app/harness/base.py`, `app/harness/hermes.py`, `app/harness/factory.py`
- Create `docker/hermes/Dockerfile.hermes` extending official image
- Create `docker/hermes/config.yaml` with Lex defaults
- Wire auth middleware, health check
- Create `docker/init-db.sql`
- **Test**: `docker compose up` boots all services, `/health` returns 200, Hermes API responds

### Phase R2: Flesh Out Services (3 days)
Port service implementations for existing routers:

**Simple services (stubs → working):**
- `files.py`, `terminal.py`, `secrets.py`, `settings.py`
- `bookmarks.py`, `notifications.py`, `profile.py`, `search.py`
- `onboarding.py`, `system.py`

**Medium services:**
- `services.py`, `datasets.py`, `sites.py`, `domains.py`
- `api_keys.py`, `admin.py`, `public_api.py`

**Complex services:**
- `sell.py` (Stripe Connect — 428 LOC)
- `space.py` (page/API editor — 379 LOC)
- `integrations.py` (OAuth2 flows — 299 LOC + provider modules)
- `skills.py` (sync with Hermes shared volume)

- **Test**: All routes return expected responses, file operations work on shared volume

### Phase R3: Chat + Streaming Integration (2 days)
- Implement `HermesHarness.chat()` and `HermesHarness.chat_stream()`
- Create `app/routers/chat.py` — proxy endpoint with SSE
- Wire frontend chat component to new endpoint
- Handle conversation state (Responses API with `conversation` param)
- Handle tool progress indicators in SSE stream
- **Test**: Full chat round-trip through browser → Lex API → Hermes → response

### Phase R4: Hermes Config + Onboarding (2 days)
- Implement `hermes_config.py` service
- Update onboarding wizard with new steps (memory provider, channels)
- Generate Hermes config.yaml + .env from onboarding selections
- Wire "save settings" to update Hermes config + restart
- **Test**: Complete onboarding → Hermes configured correctly → chat works

### Phase R5: Skills, Automations, Sessions (2 days)
- Skills: scan `~/.hermes/skills/` on shared volume, sync with Lex skills table
- Automations: read/write `~/.hermes/cron/jobs.json` on shared volume
- Sessions: query `~/.hermes/state.db` SQLite for session search
- Wire Lex API routes for these to Hermes data
- **Test**: Create skill via Lex UI → appears in Hermes. Create automation → Hermes cron picks it up. Search sessions → results from past conversations.

### Phase R6: Docker Compose + Lite Mode (1 day)
- Finalize `docker-compose.yml` (full mode, 9 services)
- Create `docker-compose.lite.yml` (lite mode override, 6 services)
- Create `docker-compose.openclaw.yml` (OpenClaw override for alternative harness)
- Test both modes
- **Test**: `docker compose up` from clean clone → working Lex instance

### Phase R7: Frontend Updates (1 day)
- Update API base URL to FastAPI
- Update chat component for new SSE format
- Update onboarding pages
- Update settings page (harness status, memory provider, model)
- Update skills page (read from Hermes)
- Verify all pages load against FastAPI backend
- **Test**: All frontend pages functional

### Phase R8: Docs + Polish (1 day)
- Update `README.md` with new quick start
- Update `SETUP.md` with full env var reference
- Create `.env.example`
- Create `docs/MIGRATION-v1-to-v2.md`
- **Test**: Fresh clone → follow README → working instance

### Phase R9: End-to-End Testing (2 days)
- Full user journey: signup → onboarding → chat → files → automations → space
- Test Telegram channel via Hermes
- Test Stripe commerce flow
- Test Honcho memory pipeline (conversations → user model → personalization)
- Test Core memory fallback (no Honcho services)
- Test lite mode Docker Compose
- Test OpenClaw harness swap
- Fix all bugs found
- **Test**: Complete QA pass, no broken features

### Timeline Summary

| Phase | Days | Cumulative | Depends On |
|-------|------|-----------|------------|
| R1: Scaffold + Hermes Docker | 2 | 2 | — |
| R2: Flesh Out Services | 3 | 5 | R1 |
| R3: Chat + Streaming | 2 | 7 | R1, R2 |
| R4: Config + Onboarding | 2 | 9 | R1, R3 |
| R5: Skills/Automations/Sessions | 2 | 11 | R3 |
| R6: Docker Compose + Lite | 1 | 12 | R1, R2 |
| R7: Frontend Updates | 1 | 13 | R3 |
| R8: Docs + Polish | 1 | 14 | R6, R7 |
| R9: E2E Testing | 2 | 16 | All |
| **Total** | **16 days** | | |

Parallelization: R2 and R3 can overlap. R5 can start as soon as R3 is done. R6 and R7 can run in parallel.

---

## 20. Testing Strategy

### Unit Tests
- FastAPI route tests using `TestClient`
- Harness mock tests (test the abstraction with mock HTTP responses)
- Database model tests
- Hermes config generation tests

### Integration Tests
- Chat round-trip (Lex API → Hermes → response)
- File operations (upload → shared volume → agent reads)
- Onboarding flow (all steps, both memory providers)
- Skills sync (Lex DB ↔ Hermes shared volume)
- Automation creation (Lex API → Hermes cron)
- Stripe webhook handling

### End-to-End
- Full user journey: signup → onboarding → chat → create site → sell product
- Channel test: Telegram message → AI response via Hermes
- Memory test: multi-turn conversation → verify personalization on return
- Harness swap: switch from Hermes to OpenClaw config → verify chat works

---

## 21. Migration Path

Since Lex has no real users (preview only), this is a clean cut:

- `master` branch = V1 (Hono/Node.js + custom agent)
- `v2` branch = V2 (FastAPI + Hermes/OpenClaw)
- When V2 is stable, merge to master
- GitHub release tags mark the transition
- Database: Alembic handles schema changes. Deleted tables were never populated with real data.

---

## 22. Comparison: V1 Plan vs V2 Plan

| Metric | V1 Plan (OpenClaw default) | V2 Plan (Hermes default) |
|--------|---------------------------|-------------------------|
| Default harness | OpenClaw (Node.js) | **Hermes Agent (Python)** |
| Integration method | WebSocket client (~400 LOC) | **HTTP API client (~200 LOC)** |
| Memory bridge | Custom Honcho bridge (~200 LOC) | **Native Hermes plugin (0 LOC)** |
| Chat protocol | Custom WS message format | **OpenAI-compatible SSE** |
| Session search | Custom tsvector + Postgres | **Hermes FTS5 SQLite (shared vol)** |
| Cron/automations | Custom implementation | **Hermes built-in (shared vol)** |
| Learning loop | Not available | **Hermes auto skill creation** |
| Terminal backends | Local only | **6 backends (Docker, SSH, Modal, etc.)** |
| Messaging platforms | ~8 | **15+** |
| Multi-user | Docker containers only | **Profiles (default) + Docker (option)** |
| Language match | Python API ↔ Node harness | **Python API ↔ Python harness** |
| Custom LOC (harness layer) | ~800 | **~200** |
| Custom LOC (product API) | ~5,000 | **~4,000** |
| Docker services (full) | 8 | **9** (added Hermes container) |
| Docker services (lite) | 6 | **6** |
| Timeline | 19 days | **16 days** |
| Risk | Medium (WS integration) | **Low (HTTP API, well-documented)** |

---

## Appendix A: Key Hermes Commands Reference

```bash
# Setup
hermes setup                    # Full setup wizard
hermes model                    # Choose AI provider + model
hermes tools                    # Configure enabled tools

# Gateway (messaging + API server)
hermes gateway                  # Start gateway (includes API server)
hermes gateway start            # Start as daemon
hermes gateway stop             # Stop gateway

# Memory
hermes memory setup             # Choose memory provider
hermes memory status            # Check active provider

# Skills
hermes skills                   # List skills
hermes skills --hub             # Browse Skills Hub

# Cron
# Jobs managed via ~/.hermes/cron/jobs.json (shared volume)

# Migration from OpenClaw
hermes claw migrate             # Import settings from ~/.openclaw
hermes claw migrate --dry-run   # Preview what would be imported

# Diagnostics
hermes doctor                   # Diagnose issues
hermes config check             # Check for missing options
```

## Appendix B: Hermes API Server Endpoints

```
POST /v1/chat/completions    # Stateless chat (OpenAI format)
POST /v1/responses            # Stateful chat (Responses API)
GET  /v1/responses/{id}       # Retrieve stored response
DELETE /v1/responses/{id}     # Delete stored response
GET  /v1/models               # List available models
GET  /health                  # Health check
```

## Appendix C: Files on Shared Volumes

```
/data/workspace/              # Lex workspace (files, sites, services)
  ├── uploads/                # User-uploaded files
  ├── sites/                  # Hosted sites
  ├── services/               # Hosted services
  └── space/                  # Space pages/APIs

/root/.hermes/                # Hermes home (shared with Lex API)
  ├── config.yaml             # Hermes configuration
  ├── .env                    # API keys and secrets
  ├── SOUL.md                 # Agent personality
  ├── memories/               # MEMORY.md, USER.md
  ├── skills/                 # Agent skills (AgentSkills format)
  ├── cron/                   # Scheduled jobs
  │   └── jobs.json           # Cron job definitions
  ├── sessions/               # Gateway sessions
  └── state.db                # SQLite session storage (FTS5)
```
