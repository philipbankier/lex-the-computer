# Lex the Computer

**Your personal AI cloud computer. One command to deploy.**

Lex is an open-source, self-hosted AI assistant — a FastAPI backend powered by an [OpenClaw](https://github.com/openclaw) agent harness, long-term memory via [Honcho](https://github.com/plastic-labs/honcho), and a Next.js frontend. Deploy it on any server with Docker.

## Quick Start

```bash
git clone https://github.com/lex-the-computer/lex
cd lex
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY (required) and any optional keys
docker compose up -d
# Visit http://localhost:3000
```

That's it. Caddy handles HTTPS automatically when `PUBLIC_DOMAIN` is set.

### Lite Mode (no Honcho memory layer)

```bash
docker compose -f docker-compose.yml -f docker-compose.lite.yml up -d
```

## Architecture

```
Docker Compose Stack
├── Caddy          — reverse proxy, auto-TLS (Let's Encrypt)
├── web            — Next.js 15 frontend
├── api            — FastAPI product API (Python)
├── openclaw       — OpenClaw agent harness (WebSocket gateway)
├── honcho-api     — Honcho memory API
├── honcho-deriver — Honcho background deriver
├── PostgreSQL     — primary database (pgvector enabled)
└── Redis          — cache & pub/sub
```

See [docs/V2-REFACTOR-PLAN.md](docs/V2-REFACTOR-PLAN.md) for the full V2 architecture and migration notes.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key (also used by Honcho) |
| `OPENCLAW_GATEWAY_TOKEN` | No | Auto-generated on first boot if empty |
| `OPENAI_API_KEY` | No | OpenAI / Codex |
| `OPENROUTER_API_KEY` | No | 200+ models via OpenRouter |
| `GEMINI_API_KEY` | No | Honcho deriver summaries |
| `PUBLIC_DOMAIN` | No | Your domain for Caddy HTTPS |
| `CADDY_EMAIL` | No | Let's Encrypt registration email |

See `.env.example` for the full list including channels, OAuth integrations, and commerce keys.

## Features

- **AI Chat** — streaming conversations with personas, rules, and @ mentions
- **Automations** — cron-scheduled AI tasks delivered to chat, email, or Telegram
- **File Manager** — upload, browse, edit files with Monaco editor and web terminal
- **Channels** — access Lex from Telegram, Discord, email, or SMS
- **Skills** — extensible AI capabilities
- **BYOK** — bring your own API keys

## Development

```bash
pnpm install
pnpm dev   # web on :3000, api on :8000
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
