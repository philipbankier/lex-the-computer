# Lex — Setup Guide

Complete guide to deploying Lex the Computer on your own server.

## Prerequisites

- **Docker** and **Docker Compose** v2+ ([install guide](https://docs.docker.com/engine/install/))
- A server or local machine (2+ vCPU, 4 GB+ RAM recommended)
- At least one AI provider API key (Anthropic recommended)

## Quick Start (3 Steps)

```bash
# 1. Clone and configure
git clone https://github.com/lex-the-computer/lex
cd lex
cp .env.example .env

# 2. Edit .env — set your Anthropic API key
#    ANTHROPIC_API_KEY=sk-ant-...

# 3. Start
docker compose up -d
```

Visit `http://localhost:3000` to begin. The onboarding wizard runs on first launch.

## Deployment Modes

### Full (default)

Includes Hermes Agent + Honcho long-term memory. Best experience — Honcho automatically learns user preferences across conversations.

```bash
docker compose up -d
```

**Services started**: web, api, hermes, honcho-api, honcho-deriver, postgres, redis, caddy

### Lite (no Honcho)

Disables Honcho services. Hermes uses built-in core memory (MEMORY.md / USER.md files) instead. Lower resource usage (~1 GB less RAM), simpler stack.

```bash
docker compose -f docker-compose.yml -f docker-compose.lite.yml up -d
```

**Services started**: web, api, hermes, postgres, redis, caddy

### OpenClaw Harness

Replaces Hermes with [OpenClaw](https://github.com/openclaw) as the agent harness. Requires `OPENCLAW_GATEWAY_TOKEN` in `.env`.

```bash
docker compose -f docker-compose.yml -f docker-compose.openclaw.yml up -d
```

**Services started**: web, api, openclaw, honcho-api, honcho-deriver, postgres, redis, caddy

## Environment Variable Reference

### AI Provider Keys

At least one is required. Anthropic is recommended (used by both Hermes and Honcho).

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key (recommended) |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (200+ models) |

### Agent Harness

| Variable | Default | Description |
|---|---|---|
| `AGENT_HARNESS` | `hermes` | Agent harness to use: `hermes` or `openclaw` |
| `HERMES_API_KEY` | `lex-local-dev` | Shared secret between API and Hermes |

### Database

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password. Change in production. |

### Authentication

| Variable | Default | Description |
|---|---|---|
| `SESSION_SECRET` | `change-me-in-production` | Secret for signing session cookies. Change in production. |
| `ALLOWED_EMAILS` | *(empty — allow all)* | Comma-separated list of allowed login emails. Empty allows any email. |

### Stripe Commerce (optional)

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint secret |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect platform client ID |

### Media APIs (optional)

| Variable | Description |
|---|---|
| `FAL_KEY` | [fal.ai](https://fal.ai) key for image/video generation (FLUX, Kling, Veo) |
| `GROQ_API_KEY` | [Groq](https://groq.com) key for fast Whisper transcription |
| `GEMINI_API_KEY` | Google Gemini key (used by Honcho deriver for summaries) |

### OAuth Integrations (optional)

Each integration requires a client ID and secret. Set up OAuth credentials with each provider and configure the redirect URI as `{BASE_URL}/api/integrations/{provider}/callback`.

| Variable | Provider |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google (Gmail, Calendar, Drive) |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | Notion |
| `DROPBOX_CLIENT_ID` / `DROPBOX_CLIENT_SECRET` | Dropbox |
| `LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET` | Linear |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Microsoft (OneDrive, Outlook) |

### Channels (optional)

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token (from @BotFather) |
| `DISCORD_BOT_TOKEN` | Discord bot token |

### Multi-User (reserved)

| Variable | Default | Description |
|---|---|---|
| `MULTI_USER` | `false` | Enable multi-user mode (reserved for future) |
| `ADMIN_EMAIL` | *(empty)* | Admin email for multi-user mode |

### Server

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:8000` | Backend API base URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API URL used by the frontend (baked into build) |

### Ports

| Variable | Default | Description |
|---|---|---|
| `WEB_PORT` | `3000` | Frontend port |
| `API_PORT` | `8000` | Backend API port |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `REDIS_PORT` | `6379` | Redis port |

### Caddy / HTTPS (production)

| Variable | Default | Description |
|---|---|---|
| `PUBLIC_DOMAIN` | `localhost` | Your domain. Caddy auto-provisions TLS when set to a real domain. |
| `CADDY_EMAIL` | *(empty)* | Email for Let's Encrypt certificate registration |

### OpenClaw (only for docker-compose.openclaw.yml)

| Variable | Default | Description |
|---|---|---|
| `OPENCLAW_GATEWAY_TOKEN` | `dev-token` | Authentication token for OpenClaw gateway |

## Custom Domain Setup

1. Point your domain's DNS A record to your server's IP address
2. Set `PUBLIC_DOMAIN=lex.yourdomain.com` in `.env`
3. Set `CADDY_EMAIL=you@example.com` for Let's Encrypt
4. Restart: `docker compose up -d`
5. Caddy automatically provisions TLS certificates

## Channel Setup Guides

### Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot with `/newbot`
3. Copy the token to `TELEGRAM_BOT_TOKEN` in `.env`
4. Restart Lex — the bot connects automatically via Hermes

### Discord Bot

1. Create an application at [discord.com/developers](https://discord.com/developers/applications)
2. Create a bot under the application
3. Copy the bot token to `DISCORD_BOT_TOKEN` in `.env`
4. Invite the bot to your server with the OAuth2 URL generator
5. Restart Lex

### Google (Gmail, Calendar, Drive)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail, Calendar, and Drive APIs
3. Create OAuth 2.0 credentials (Web application type)
4. Add redirect URI: `{BASE_URL}/api/integrations/google/callback`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

## Backup & Restore

### Backup

```bash
# Database
docker compose exec postgres pg_dump -U postgres lex > backup.sql

# Workspace files
docker compose cp api:/data/workspace ./workspace-backup
```

### Restore

```bash
# Database
cat backup.sql | docker compose exec -T postgres psql -U postgres lex

# Workspace files
docker compose cp ./workspace-backup/. api:/data/workspace
```

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

Database migrations run automatically on API startup via Alembic.

## Troubleshooting

**The app won't start**
Check logs: `docker compose logs -f`. Ensure at least one AI API key is set in `.env`.

**AI responses aren't working**
Verify your API key is valid. Check Hermes logs: `docker compose logs hermes`.

**Telegram bot isn't responding**
Ensure `TELEGRAM_BOT_TOKEN` is set. Check Hermes logs for connection errors: `docker compose logs hermes`.

**Honcho memory not working**
Check Honcho API health: `docker compose logs honcho-api`. The deriver requires `ANTHROPIC_API_KEY` and optionally `GEMINI_API_KEY`.

**Port conflicts**
Override default ports in `.env`: `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`.

**Health checks failing**
Wait 30-60 seconds — services start in dependency order. Check individual service logs to identify the failing service.

## Recommended Server Specs

| Use Case | Specs | Estimated Cost |
|---|---|---|
| Personal (1 user, Lite mode) | 2 vCPU, 2 GB RAM, 20 GB storage | ~$12/mo |
| Personal (1 user, Full mode) | 2 vCPU, 4 GB RAM, 40 GB storage | ~$20/mo |
| Team (5-10 users) | 4 vCPU, 8 GB RAM, 100 GB storage | ~$40/mo |
