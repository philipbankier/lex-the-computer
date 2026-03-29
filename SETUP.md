# Lex — Self-Hosting Setup Guide

## Prerequisites

- **Docker** and **Docker Compose** (v2+)
- A server or local machine (2+ vCPU, 4GB+ RAM recommended)
- At least one AI provider API key

## Quick Start (3 Steps)

```bash
# 1. Clone and configure
git clone https://github.com/lex-the-computer/lex
cd lex
cp .env.example .env

# 2. Edit .env — add your AI API key
# OPENAI_API_KEY=sk-...
# or ANTHROPIC_API_KEY=sk-ant-...

# 3. Start
docker compose up -d
```

Visit `http://localhost:3000` to begin.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (or use another provider below) |

### AI Providers (at least one required)

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI (GPT-4, etc.) |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `GOOGLE_AI_KEY` | Google AI (Gemini) |
| `OLLAMA_BASE_URL` | Local Ollama instance |

### Domain & HTTPS (optional)

| Variable | Description |
|----------|-------------|
| `DOMAIN` | Your domain (e.g., `lex.example.com`) |
| `SITES_DOMAIN` | Wildcard for hosted sites (e.g., `sites.example.com`) |
| `SPACE_DOMAIN` | Personal space domain (e.g., `space.example.com`) |

### Channels (optional)

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_APPLICATION_ID` | Discord application ID |
| `EMAIL_PROVIDER` | `cloudflare`, `postal`, or `mailgun` |
| `EMAIL_DOMAIN` | Email domain for inbound email |
| `TWILIO_ACCOUNT_SID` | Twilio SID for SMS |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |

### Integrations (optional)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (Gmail, Calendar, Drive) |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | Notion OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `DROPBOX_CLIENT_ID` / `DROPBOX_CLIENT_SECRET` | Dropbox OAuth |
| `LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET` | Linear OAuth |

## Custom Domain Setup

1. Point your domain's DNS to your server IP
2. Set `DOMAIN=lex.yourdomain.com` in `.env`
3. For site hosting, set `SITES_DOMAIN=sites.yourdomain.com` and add a wildcard DNS record `*.sites.yourdomain.com`
4. Caddy will automatically provision TLS certificates

## Provider Setup Guides

### Telegram Bot
1. Message `@BotFather` on Telegram
2. Create a new bot with `/newbot`
3. Copy the token to `TELEGRAM_BOT_TOKEN`

### Gmail / Google Calendar / Drive
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail, Calendar, and Drive APIs
3. Create OAuth 2.0 credentials
4. Set redirect URI to `{BASE_URL}/api/integrations/gmail/callback`
5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`

### Notion
1. Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copy the integration token
3. In Lex Settings → Integrations, paste the token

## Backup & Restore

### Backup
```bash
# Database
docker compose exec postgres pg_dump -U lex lex > backup.sql

# Workspace files
tar czf workspace-backup.tar.gz /data/workspace/
```

### Restore
```bash
# Database
cat backup.sql | docker compose exec -T postgres psql -U lex lex

# Workspace files
tar xzf workspace-backup.tar.gz -C /
```

## Troubleshooting

**Q: The app won't start**
A: Check logs with `docker compose logs -f`. Ensure `DATABASE_URL` and at least one API key are set.

**Q: AI responses aren't working**
A: Verify your API key is valid. Check LiteLLM proxy logs: `docker compose logs litellm`.

**Q: Telegram bot isn't responding**
A: Ensure `TELEGRAM_BOT_TOKEN` is set and the bot is started. Check logs for connection errors.

**Q: Sites aren't accessible publicly**
A: Ensure `SITES_DOMAIN` is set with proper DNS. Check Caddy logs for TLS issues.

## Recommended VPS Specs

| Use Case | Specs | Cost |
|----------|-------|------|
| Personal (1 user) | 2 vCPU, 4GB RAM, 40GB storage | ~$20/mo |
| Team (5-10 users) | 4 vCPU, 8GB RAM, 100GB storage | ~$40/mo |
| With local AI (Ollama) | 8GB+ RAM or GPU | Varies |
