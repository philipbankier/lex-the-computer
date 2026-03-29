# Lex the Computer

**Your personal AI cloud computer. One command to deploy.**

Lex is an open-source, self-hosted AI assistant platform. Deploy it on any server and get a complete AI-powered workspace: chat, file management, automations, site hosting, a Skills marketplace, multi-channel access, and more.

## Features

- **AI Chat** — Multi-model conversations with streaming, personas, rules, and @ mentions
- **File Manager** — Upload, browse, edit files with Monaco editor and web terminal
- **Automations** — Cron-scheduled AI tasks with delivery to chat, email, or Telegram
- **Site Hosting** — Create and publish websites with live preview and custom domains
- **Space** — Personal domain with custom pages and API endpoints
- **Skills** — Extensible AI capabilities with a community Hub marketplace
- **Integrations** — Gmail, Calendar, Notion, Drive, Dropbox, Linear, GitHub
- **Channels** — Access Lex from Telegram, email, Discord, or SMS
- **Datasets** — Upload CSV/JSON, explore with SQL queries (DuckDB-powered)
- **20 Themes** — From Midnight to Mint, dark and light
- **BYOK** — Bring your own API keys for OpenAI, Anthropic, Google, and more
- **Public API** — REST API with API key auth for programmatic access

## Quick Start

```bash
git clone https://github.com/lex-the-computer/lex
cd lex
cp .env.example .env
# Edit .env: set at least one AI provider key (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
docker compose up -d
# Visit http://localhost:3000
```

See [SETUP.md](SETUP.md) for detailed self-hosting instructions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, shadcn/ui patterns |
| Backend | Node.js, Hono, Drizzle ORM |
| Database | PostgreSQL, Redis, DuckDB (datasets) |
| AI | LiteLLM Proxy (multi-model routing) |
| Channels | Telegram (grammy), Discord (discord.js), Email, SMS (Twilio) |
| Infrastructure | Docker Compose, Caddy (reverse proxy + auto TLS) |

## Architecture

```
Docker Compose Stack
├── Caddy (reverse proxy, HTTPS, wildcard certs)
├── Lex App (Next.js + Hono API)
│   ├── Web UI (chat, files, automations, sites, space, skills, settings)
│   ├── API Server (REST endpoints, SSE streaming)
│   └── Core Services (AI engine, scheduler, channel router)
├── PostgreSQL
├── Redis
└── LiteLLM Proxy (multi-model routing)
```

## Project Structure

```
packages/
├── web/          # Next.js frontend (App Router)
├── core/         # Hono API server
└── shared/       # Shared types & constants
```

## Development

```bash
pnpm install
pnpm dev          # Runs web (port 3000) + core (port 3001)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT
