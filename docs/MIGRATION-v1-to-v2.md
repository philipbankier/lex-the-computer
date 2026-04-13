# Migration Guide: V1 to V2

This guide covers what changed between Lex V1 and V2, and how to migrate an existing V1 deployment.

## Summary of Changes

| Component | V1 | V2 |
|---|---|---|
| Backend | Hono (Node.js/TypeScript) on port 3001 | FastAPI (Python 3.12) on port 8000 |
| Agent harness | Custom AI tools in `packages/core` | Hermes Agent (default) or OpenClaw |
| Memory | Honcho (same) | Honcho (default) or Core memory (Lite mode) |
| AI routing | LiteLLM proxy on port 4000 | Direct API keys passed to Hermes |
| Database ORM | Drizzle ORM (TypeScript) | SQLAlchemy (Python) |
| Database schema | 30+ tables (conversations, messages, personas, agents, ...) | User/product tables only — chat state managed by harness |
| Auth | Better Auth library | Session-based auth (FastAPI) |
| Frontend API URL | `http://localhost:3001` (core) | `http://localhost:8000` (api) |
| Docker Compose | `docker-compose.dev.yml` | `docker-compose.yml` + optional overrides |
| Environment file | `.env.v1.example` | `.env.example` |

## What Moved to the Harness

In V2, the agent harness (Hermes or OpenClaw) manages:

- **Conversations and messages** — no longer stored in PostgreSQL; managed by Hermes internally
- **Personas and rules** — configured in Hermes via SOUL.md / USER.md files
- **AI model selection** — configured in Hermes `config.yaml`, not via LiteLLM
- **Tool execution** — handled by Hermes (47+ built-in tools), not custom code in `packages/core`
- **Channel connections** — Telegram, Discord, etc. connect directly through Hermes

## Database Changes

### Tables Removed (managed by harness)

These V1 tables are no longer needed — their data is managed by the agent harness:

- `conversations` — sessions managed by Hermes
- `messages` — message history stored in Hermes data
- `personas` — replaced by Hermes SOUL.md configuration
- `rules` — replaced by Hermes configuration
- `automations` / `automation_runs` — managed by Hermes cron
- `channels` / `channel_messages` / `channel_configs` — managed by Hermes
- `ai_providers` — replaced by direct API key configuration
- `browser_sessions` — managed by Hermes browser tool
- `ssh_keys` — managed by Hermes terminal tool

### Tables Retained

These tables are still in PostgreSQL, managed by the FastAPI backend:

- `users` / `user_profiles`
- `sites`
- `integrations`
- `api_keys`
- `skills` / `skills_hub`
- `secrets`
- `datasets`
- `space_routes` / `space_route_versions` / `space_assets` / `space_settings` / `space_errors`
- `custom_domains`
- `services`
- `bookmarks`
- `notifications`
- `stripe_*` (accounts, products, prices, payment_links, orders)
- `user_containers` / `usage_records`

### Migration Strategy

V2 uses Alembic for database migrations. On first startup with a fresh database, migrations run automatically. If migrating from V1:

1. **Back up your V1 database**: `docker compose exec postgres pg_dump -U lex lex > v1-backup.sql`
2. **Start V2 with a fresh database** — the simplest path. V2 creates its own schema via Alembic.
3. **Re-import user data** if needed — user accounts, integrations, sites, and other product data can be migrated manually from the backup.

Chat history from V1 is not directly importable into Hermes — treat V2 as a fresh start for conversations. Honcho will rebuild its memory model from new conversations.

## Environment Variable Changes

### Removed Variables

| V1 Variable | Notes |
|---|---|
| `CORE_PORT` / `CORE_URL` | Replaced by `API_PORT` (default 8000) |
| `AUTH_SECRET` / `AUTH_COOKIE_NAME` | Replaced by `SESSION_SECRET` |
| `DATABASE_URL` | Now constructed from `POSTGRES_PASSWORD` inside Docker |
| `LITELLM_PORT` / `LITELLM_URL` | LiteLLM proxy removed — API keys go directly to Hermes |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | No longer used |
| `GOOGLE_AI_KEY` | Renamed to `GEMINI_API_KEY` |
| `OLLAMA_BASE_URL` | Not supported in V2 (use OpenRouter for non-Anthropic models) |
| `SHOW_LANDING` | Not used in V2 |
| `CONTAINER_*` limits | Reserved for future multi-user |

### New Variables

| V2 Variable | Description |
|---|---|
| `AGENT_HARNESS` | `hermes` (default) or `openclaw` |
| `HERMES_API_KEY` | Shared secret between API and Hermes (default: `lex-local-dev`) |
| `NEXT_PUBLIC_API_URL` | Frontend API URL (default: `http://localhost:8000`) |
| `OPENCLAW_GATEWAY_TOKEN` | Only needed with `docker-compose.openclaw.yml` |

### Renamed Variables

| V1 | V2 | Notes |
|---|---|---|
| `DOMAIN` | `PUBLIC_DOMAIN` | Used by Caddy for auto-HTTPS |
| `POSTGRES_USER` | *(hardcoded to `postgres`)* | Simplified for Docker |
| `POSTGRES_DB` | *(hardcoded to `lex`)* | Simplified for Docker |

## Frontend Changes

The frontend (`packages/web`) now points to port 8000 instead of 3001:

- `NEXT_PUBLIC_API_URL` should be `http://localhost:8000` (or your production URL)
- SSE streaming format is preserved — the FastAPI backend proxies chat streams from Hermes in the same format V1 used
- The onboarding wizard now generates Hermes configuration files instead of writing to the database

## Docker Compose Changes

V1 used `docker-compose.dev.yml` with a monorepo mount for hot-reload development. V2 uses production-first Docker images:

| V1 File | V2 Equivalent | Purpose |
|---|---|---|
| `docker-compose.dev.yml` | `docker-compose.yml` | Primary stack |
| *(N/A)* | `docker-compose.lite.yml` | Override to disable Honcho |
| *(N/A)* | `docker-compose.openclaw.yml` | Override to swap Hermes for OpenClaw |

## Step-by-Step Migration

1. **Back up everything**:
   ```bash
   docker compose exec postgres pg_dump -U lex lex > v1-backup.sql
   docker compose cp core:/data/workspace ./workspace-backup
   ```

2. **Stop V1**:
   ```bash
   docker compose -f docker-compose.dev.yml down
   ```

3. **Update your `.env`**:
   ```bash
   cp .env.example .env
   # Copy over API keys and integration credentials from your V1 .env
   # Set ANTHROPIC_API_KEY (required for Hermes + Honcho)
   ```

4. **Start V2**:
   ```bash
   docker compose up -d
   ```

5. **Restore workspace files** (if applicable):
   ```bash
   docker compose cp ./workspace-backup/. api:/data/workspace
   ```

6. **Run onboarding** — visit `http://localhost:3000` and complete the V2 onboarding wizard to configure Hermes.

7. **Verify**:
   ```bash
   docker compose ps          # all services healthy
   docker compose logs api    # no errors
   docker compose logs hermes # agent ready
   ```
