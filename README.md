# Lex the Computer

**Your personal AI cloud computer. One command to deploy.**

Lex is an open-source, self-hosted AI assistant that runs as a Docker stack on any server. It combines a [Hermes](https://github.com/hermes-agent/hermes) agent harness, long-term memory via [Honcho](https://github.com/plastic-labs/honcho), a FastAPI product backend, and a Next.js frontend into a single `docker compose up`.

## Quick Start

```bash
git clone https://github.com/lex-the-computer/lex
cd lex
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY (required)
docker compose up -d
# Visit http://localhost:3000
```

That's it. Caddy handles HTTPS automatically when `PUBLIC_DOMAIN` is set.

See [docs/SETUP.md](docs/SETUP.md) for the full setup guide including prerequisites, all environment variables, and troubleshooting.

## Architecture

```
Docker Compose Stack (9 services)
├── Caddy            — reverse proxy, auto-TLS (Let's Encrypt)
├── web              — Next.js 16 frontend (React 19, Tailwind 4)
├── api              — FastAPI product API (Python 3.12)
├── hermes           — Hermes Agent harness (OpenAI-compatible API)
├── honcho-api       — Honcho memory API (long-term user memory)
├── honcho-deriver   — Honcho background deriver (memory extraction)
├── PostgreSQL 16    — primary database (pgvector enabled)
└── Redis 7          — cache & pub/sub
```

The **API** handles all product logic (files, sites, automations, integrations, commerce) and proxies chat to the **agent harness** via a pluggable abstraction layer. Hermes is the default harness; OpenClaw is available as an alternative.

**Honcho** provides long-term conversational memory — it automatically extracts user facts and preferences from conversations. In **Lite mode**, Honcho is disabled and Hermes uses its built-in core memory (MEMORY.md files) instead.

## Deployment Modes

### Full (default)

All services including Honcho long-term memory:

```bash
docker compose up -d
```

### Lite (no Honcho)

Disables Honcho services — Hermes uses built-in core memory instead. Lower resource usage, simpler stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.lite.yml up -d
```

### OpenClaw Harness

Swaps Hermes for [OpenClaw](https://github.com/openclaw) as the agent harness:

```bash
docker compose -f docker-compose.yml -f docker-compose.openclaw.yml up -d
```

Requires `OPENCLAW_GATEWAY_TOKEN` in `.env`.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key (used by Hermes and Honcho) |
| `OPENAI_API_KEY` | No | OpenAI models |
| `OPENROUTER_API_KEY` | No | 200+ models via OpenRouter |
| `PUBLIC_DOMAIN` | No | Your domain for Caddy auto-HTTPS |
| `CADDY_EMAIL` | No | Let's Encrypt registration email |
| `SESSION_SECRET` | No | Auth cookie secret (change in production) |
| `POSTGRES_PASSWORD` | No | Database password (default: `postgres`) |

See [`.env.example`](.env.example) for the full list including channels, OAuth integrations, media APIs, and commerce keys.

## Features

- **AI Chat** — streaming conversations with SSE, session management, and search
- **Automations** — cron-scheduled AI tasks delivered to chat, email, Telegram, or Discord
- **File Manager** — upload, browse, and edit files with Monaco editor
- **Web Terminal** — browser-based terminal access
- **Personal Space** — programmable personal domain with pages and API routes
- **Sites** — deploy and host web applications
- **Skills** — extensible AI capabilities (install from hub or create custom)
- **Channels** — access Lex from Telegram, Discord, email, or SMS
- **Integrations** — connect Google, Notion, GitHub, Dropbox, Linear, Spotify, Microsoft
- **Commerce** — sell products with Stripe Connect (0% platform fee)
- **Datasets** — upload and query data with DuckDB analytics
- **BYOK** — bring your own API keys for any supported provider

## Project Structure

```
packages/
├── web/                  # Next.js 16 frontend (React 19, Tailwind 4)
│   ├── app/(auth)/       # Login & signup
│   ├── app/(app)/        # Main app pages (chat, files, space, sites, ...)
│   └── components/       # Shared UI components
│
├── api/                  # FastAPI backend (Python 3.12)
│   ├── app/routers/      # 26 API router modules
│   ├── app/harness/      # Agent harness abstraction (Hermes, OpenClaw)
│   ├── app/services/     # Business logic
│   └── alembic/          # Database migrations
│
├── core/                 # Legacy Hono backend (V1, being replaced)
├── shared/               # Shared TypeScript types
└── desktop/              # Tauri v2 desktop app (macOS, Windows, Linux)

docker/
├── Dockerfile.api        # FastAPI container
├── Dockerfile.web        # Next.js container (multi-stage build)
└── hermes/               # Hermes Agent container + config

deploy/
├── caddy/Caddyfile       # Reverse proxy configuration
└── litellm/config.yaml   # LiteLLM model routing (V1)
```

## Development

### Prerequisites

- Node.js 20+, pnpm 9+
- Python 3.12+
- PostgreSQL 16+, Redis 7+

### Running Locally

```bash
pnpm install
pnpm dev   # web on :3000, api on :8000
```

Or use Docker for everything:

```bash
docker compose up -d
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for coding conventions and how to add pages, routes, and skills.

## Documentation

- [Setup Guide](docs/SETUP.md) — full installation and configuration reference
- [Migration Guide (V1 to V2)](docs/MIGRATION-v1-to-v2.md) — upgrading from V1
- [Architecture](docs/ARCHITECTURE.md) — system design and internals
- [Contributing](CONTRIBUTING.md) — developer setup and conventions
- [V2 Refactor Plan](docs/V2-REFACTOR-PLAN-v2.md) — design decisions and roadmap

## License

MIT
