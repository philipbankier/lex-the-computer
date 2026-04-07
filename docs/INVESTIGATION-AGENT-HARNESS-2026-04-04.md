# Lex the Computer — Agent Harness Investigation

**Date**: April 4, 2026
**Purpose**: Investigate whether Lex should wrap OpenClaw, Hermes Agent, or both as the agent harness instead of custom-building its own AI orchestration layer.

---

## Part 1: The Three Candidates

### A. OpenClaw (what we're running on right now)
- **Language**: Node.js/TypeScript
- **Architecture**: Gateway daemon (WebSocket API) + embedded Pi agent core
- **Channels**: WhatsApp, Telegram, Discord, iMessage, Signal, Slack, Matrix, Teams, and more via plugins
- **Agent loop**: Embedded runtime with streaming, tool execution, compaction, retries, steering
- **Sessions**: Per-agent isolated sessions with per-peer/per-channel scoping
- **Skills**: AgentSkills format (agentskills.io) — same spec Lex already uses
- **Memory**: Markdown-based (MEMORY.md + daily notes) with vector search (multiple embedding providers), QMD sidecar, auto-flush before compaction
- **Providers**: 35+ model providers via plugin system, OAuth support
- **Plugin system**: Native capability model (providers, channels, speech, image gen, web search, memory, context engines)
- **MCP**: Both server and client
- **ACP**: Full bridge for Codex, Claude Code, Gemini CLI, Zed, etc.
- **Cron**: Built-in agent-level cron with platform delivery
- **Multi-agent**: Full multi-agent routing with isolated workspaces
- **Deployment**: Self-hosted daemon, single process

### B. Hermes Agent (by Nous Research)
- **Language**: Python
- **Architecture**: CLI + Gateway + ACP adapter
- **Relationship to OpenClaw**: Fork/evolution — has `hermes claw migrate` command for migrating FROM OpenClaw. Shares many concepts (gateway, skills, AgentSkills format, ACP, similar channel support).
- **Channels**: Telegram, Discord, Slack, WhatsApp, Signal, Email, Home Assistant
- **Agent loop**: AIAgent in run_agent.py — provider selection, prompt construction, tool execution, retries, compression
- **Skills**: AgentSkills format (agentskills.io compatible), auto-creation from experience, self-improvement
- **Memory**: MEMORY.md + USER.md (bounded, curated), FTS5 session search with LLM summarization, **7 external memory provider plugins** including:
  - **Honcho** (dialectic user modeling)
  - **OpenViking**
  - **Mem0**
  - **Hindsight**
  - **Holographic**
  - **RetainDB**
  - **ByteRover**
- **Unique features**:
  - Closed learning loop — agent creates skills from experience, skills self-improve
  - Session search across all past conversations
  - 6 terminal backends (local, Docker, SSH, Daytona, Singularity, Modal)
  - RL/Atropos environment framework for trajectory generation and training
  - Batch trajectory generation for fine-tuning
- **Providers**: Nous Portal, OpenRouter, OpenAI/Codex, Anthropic/Claude, Z.AI/GLM, Kimi, MiniMax, Alibaba, HuggingFace, GitHub Copilot, DeepSeek, custom endpoints
- **Deployment**: Self-hosted, runs on $5 VPS to GPU clusters, serverless via Daytona/Modal

### C. Honcho (by Plastic Labs)
- **What it is**: Not an agent framework — it's a **memory library/service**
- **Language**: Python (FastAPI server) + Python/TypeScript SDKs
- **Architecture**: Standalone memory service with managed cloud option
- **Key concepts**: Workspaces, Peers, Sessions, Messages, Representations
- **Capabilities**:
  - Dialectic user modeling (builds evolving models of entities)
  - Semantic search across message history
  - Session context with token-bounded summaries
  - Peer representations (per-session views of entities)
  - Natural language chat endpoint for querying about users
- **Integration**: Works with any framework/model — not tied to any agent harness
- **Pricing**: Self-hostable (open source) or managed at app.honcho.dev ($100 free credits)
- **Current status**: v3.0.5, active development, used by Hermes as a memory plugin

---

## Part 2: Key Relationship — Hermes is a Fork/Evolution of OpenClaw

This is the most important finding. Hermes Agent isn't just "another framework" — it has a **direct migration path from OpenClaw**:

```
hermes claw migrate          # Interactive migration (full preset)
hermes claw migrate --dry-run # Preview what would be migrated
```

It imports: settings, memories, skills, and API keys from `~/.openclaw`.

This means:
1. The two projects share deep architectural DNA
2. Hermes has evolved beyond OpenClaw in some areas (memory plugins, learning loop, terminal backends, RL infrastructure)
3. OpenClaw has evolved beyond Hermes in other areas (plugin architecture, multi-agent routing, Node.js ecosystem)
4. Both use the AgentSkills format
5. Both have similar gateway architectures for messaging channels

---

## Part 3: What Lex Currently Builds From Scratch (That These Projects Already Do)

| Feature | Lex (custom) | OpenClaw | Hermes |
|---------|-------------|----------|--------|
| AI model routing | LiteLLM + AI SDK v6 | 35+ providers via plugins | 20+ providers |
| Streaming chat | Custom Vercel AI SDK hooks | Embedded Pi agent core | AIAgent loop |
| Tool execution | Custom tool system | Full tool pipeline with approval | 40+ tools with toolsets |
| Channels | grammY, discord.js, Twilio (thin) | WhatsApp, Telegram, Discord, iMessage, Signal, Matrix, Teams+ | Telegram, Discord, Slack, WhatsApp, Signal, Email |
| Sessions | Custom conversation table | Per-agent/per-peer/per-channel with compaction | SQLite with FTS5 + compression |
| Skills | AgentSkills (filesystem) | AgentSkills (filesystem) | AgentSkills + auto-creation + self-improvement |
| Memory | None (basic conversation history) | MEMORY.md + vector search + QMD | MEMORY.md + USER.md + 7 external plugins (Honcho, Mem0, etc.) |
| MCP | Custom @modelcontextprotocol/sdk | Full MCP server + client | MCP integration |
| ACP | None | Full ACP bridge | ACP adapter |
| Cron/Automations | Custom BullMQ | Built-in cron with delivery | First-class cron tasks |
| Multi-agent | None | Full multi-agent routing | Single agent (focused) |

**The overlap is enormous.** Lex reinvented most of this from scratch.

---

## Part 4: What Lex Has That Neither Framework Provides

These are the Zo Computer product features that make Lex unique:

1. **Web UI** — Full Next.js app with tab-based workspace
2. **File browser** — Grid/list view, Monaco editor, drag & drop
3. **Space** — Personal domain editor (pages + APIs)
4. **Sites & Services** — Hosted apps with Hono+Bun
5. **Datasets** — DuckDB analytics explorer
6. **Stripe Commerce** — Products, payment links, orders, fulfillment
7. **Onboarding wizard** — Multi-step guided setup
8. **Theme system** — 20+ named themes
9. **Admin dashboard** — Multi-user management
10. **Desktop app** — Tauri v2 with file sync
11. **Custom domains** — Caddy auto-HTTPS

Neither OpenClaw nor Hermes is trying to be a web product. They're **agent runtimes**. Lex is the **product layer** on top.

---

## Part 5: Recommended Architecture

### The Ideal Split

```
┌─────────────────────────────────────────────┐
│                  Lex Web UI                   │
│  (Next.js 16 — files, space, sell, themes)   │
├─────────────────────────────────────────────┤
│              Lex Product API                  │
│  (Hono — files, sites, datasets, commerce)   │
├─────────────────────────────────────────────┤
│         Agent Harness (swappable)             │
│  ┌──────────┐  OR  ┌──────────────┐          │
│  │ OpenClaw │      │ Hermes Agent │          │
│  └──────────┘      └──────────────┘          │
│  Provides: chat, tools, channels, skills,    │
│  memory, MCP, ACP, cron, model routing       │
├─────────────────────────────────────────────┤
│              Memory Layer                     │
│  ┌────────┐ ┌──────┐ ┌──────┐ ┌────────┐   │
│  │ Honcho │ │ Mem0 │ │ Core │ │ Custom │   │
│  └────────┘ └──────┘ └──────┘ └────────┘   │
└─────────────────────────────────────────────┘
```

### What This Means Concretely

**Lex keeps:**
- The entire web UI (packages/web)
- File browser, Space, Sites, Datasets, Commerce, Admin, Desktop
- The Hono API server for product-specific routes
- The database schema for product features (sites, stripe, domains, etc.)

**Lex delegates to the agent harness:**
- All AI chat/streaming → agent gateway
- Tool execution → agent tool system
- Channels (Telegram, Discord, etc.) → agent gateway channels
- Skills → agent skills system (shared filesystem)
- Memory → agent memory system (with Honcho/Mem0 plugins available)
- MCP/ACP → agent's built-in bridges
- Automations/Cron → agent cron system
- Model routing → agent provider system

**The harness is swappable:**
- `AGENT_HARNESS=openclaw` → uses OpenClaw gateway
- `AGENT_HARNESS=hermes` → uses Hermes Agent
- Default could be either (Hermes might be better for a Zo-like product because of its Python flexibility, learning loop, and memory plugins)

---

## Part 6: OpenClaw vs Hermes — Which Default?

### Arguments for OpenClaw as default:
- Node.js ecosystem matches Lex's stack (both TypeScript)
- More mature plugin architecture
- Multi-agent routing (useful for multi-user mode)
- We're literally running on it right now
- Plugin system could host Lex features as plugins

### Arguments for Hermes as default:
- **Memory plugins** — 7 external providers including Honcho, this is huge
- **Learning loop** — skills auto-create and self-improve (Zo doesn't even have this)
- **Terminal backends** — Docker, SSH, Daytona, Modal, Singularity (serverless agent compute)
- **RL infrastructure** — trajectory generation for fine-tuning (research advantage)
- **Session search** — FTS5 across all past conversations with LLM summarization
- **Active Nous Research backing** — well-funded, research-first org
- **Direct OpenClaw migration** — can import everything from OpenClaw
- **Better fit for "personal AI computer"** — the learning loop + memory plugins make the agent genuinely personal

### My lean: **Hermes as default, OpenClaw as alternative**

The learning loop and memory plugin ecosystem (especially Honcho) are exactly what makes a "personal AI computer" feel magical. Zo's magic isn't just the UI — it's that the AI actually remembers you and improves. Hermes delivers that out of the box.

---

## Part 7: Open Questions

1. **Integration mechanism** — How does Lex's Hono backend talk to Hermes (Python) or OpenClaw (Node.js)? Options:
   - Subprocess + stdin/stdout (simplest)
   - HTTP API (Hermes has none natively, OpenClaw has WS)
   - Embed as library (possible with OpenClaw/Node.js, not with Hermes/Python)
   - Sidecar process with IPC

2. **Docker Compose topology** — Does the agent harness run as a separate container? Or same process?

3. **Migration effort** — How much of Lex's current `packages/core` gets deleted vs refactored?

4. **Memory plugin configuration** — Should Honcho be the default memory provider? Or let users choose?

5. **Hermes' maturity** — Need to verify: is Hermes production-stable for always-on gateway use? Or still primarily CLI-focused?

---

## Part 8: Next Steps (if we proceed)

1. **Prototype the integration** — Try running Hermes gateway alongside Lex's web server, wire chat through it
2. **Map the API surface** — Document exactly which Lex routes delegate to the harness vs stay in Lex
3. **Test Honcho integration** — Set up Honcho as a memory provider, verify the user modeling actually works
4. **Evaluate Hermes gateway stability** — Run it for a week as an always-on messaging gateway
5. **Design the harness abstraction** — TypeScript interface that both OpenClaw and Hermes can satisfy
