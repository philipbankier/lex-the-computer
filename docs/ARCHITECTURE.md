# Lex the Computer — Architecture

## Design Philosophy

**Default: single-user, dead simple.** One `docker compose up` and you have your own personal AI computer. No Docker-in-Docker, no container orchestration, no complexity.

**Opt-in: multi-user mode** for teams and managed platforms. Enable with `MULTI_USER=true` — each user gets an isolated Docker container.

This means 90% of self-hosters (solo users deploying via Claude Code or a VPS setup guide) get a buttery smooth experience, while the managed platform can flip the multi-user switch.

## Architecture: Single-User Mode (Default)

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                    │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              CADDY (Reverse Proxy)                   │ │
│  │  lex.yourdomain.com → Web UI                        │ │
│  │  *.sites.yourdomain.com → User Sites (Bun)          │ │
│  │  Automatic HTTPS + wildcard certs                    │ │
│  └──────────────┬──────────────────────────────────────┘ │
│                  │                                        │
│  ┌──────────────▼──────────────────────────────────────┐ │
│  │           LEX APP (single Node.js process)           │ │
│  │                                                      │ │
│  │  ┌────────────────┐  ┌───────────────────────────┐  │ │
│  │  │  Next.js Web UI │  │  Hono API Server          │  │ │
│  │  │  - Chat         │  │  - /api/chat (SSE)        │  │ │
│  │  │  - Files        │  │  - /api/files             │  │ │
│  │  │  - Sites        │  │  - /api/automations       │  │ │
│  │  │  - Automations  │  │  - /api/settings          │  │ │
│  │  │  - Settings     │  │  - /api/sites             │  │ │
│  │  │  - Terminal     │  │  - /api/tools             │  │ │
│  │  └────────────────┘  └───────────────────────────┘  │ │
│  │                                                      │ │
│  │  ┌────────────────────────────────────────────────┐  │ │
│  │  │            CORE SERVICES                        │  │ │
│  │  │  ┌──────────┐ ┌───────────┐ ┌──────────────┐  │  │ │
│  │  │  │AI Engine │ │ Scheduler │ │ Channel      │  │  │ │
│  │  │  │(LiteLLM  │ │ (BullMQ)  │ │ Router       │  │  │ │
│  │  │  │ client)  │ │           │ │ (TG/Email)   │  │  │ │
│  │  │  └──────────┘ └───────────┘ └──────────────┘  │  │ │
│  │  │  ┌──────────┐ ┌───────────┐ ┌──────────────┐  │  │ │
│  │  │  │Workspace │ │Integration│ │ Site Manager │  │  │ │
│  │  │  │Manager   │ │ Hub       │ │ (Bun runner) │  │  │ │
│  │  │  │(fs ops)  │ │ (OAuth)   │ │              │  │  │ │
│  │  │  └──────────┘ └───────────┘ └──────────────┘  │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────┐  ┌───────┐  ┌───────────────────────┐   │
│  │ PostgreSQL │  │ Redis │  │ Workspace Volume       │   │
│  │            │  │       │  │ /data/workspace/       │   │
│  │            │  │       │  │   ├── files/            │   │
│  │            │  │       │  │   ├── sites/            │   │
│  │            │  │       │  │   ├── skills/           │   │
│  │            │  │       │  │   └── .config/          │   │
│  └────────────┘  └───────┘  └───────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           LITELLM PROXY (sidecar)                     │ │
│  │  Multi-model routing: OpenAI, Anthropic, Google,      │ │
│  │  Ollama, any OpenAI-compatible endpoint               │ │
│  │  BYOK support, cost tracking, rate limiting           │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### How Tool Execution Works (Single-User)
```
User message → AI decides to use tools →
  API server executes directly in workspace:
    - File ops: fs read/write in /data/workspace/
    - Shell commands: child_process.exec (sandboxed to workspace dir)
    - Site ops: Bun process management
  Result → back to AI → response to user
```

No Docker-in-Docker. No container management. Just direct filesystem and process operations within the workspace, same model as OpenClaw.

## Architecture: Multi-User Mode (Opt-In)

When `MULTI_USER=true`:

```
Same stack as above, PLUS:

┌────────────────────────────────────────────────┐
│      USER CONTAINERS (Docker-in-Docker)         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ User A   │ │ User B   │ │ User C   │       │
│  │ /workspace│ │ /workspace│ │ /workspace│      │
│  │  - files  │ │  - files  │ │  - files  │      │
│  │  - sites  │ │  - sites  │ │  - sites  │      │
│  │  - Bun    │ │  - Bun    │ │  - Bun    │      │
│  └──────────┘ └──────────┘ └──────────┘       │
└────────────────────────────────────────────────┘

Tool execution → docker exec in user's container
                 instead of direct fs/process ops
```

The Container Manager service only activates in multi-user mode. It handles:
- Provisioning containers on user signup
- Routing tool execution to the right container
- Resource limits per user
- Idle container shutdown/restart

## Tech Stack

### Frontend
- **Next.js 15** (App Router) — Main web application
- **React 19** — UI framework
- **shadcn/ui + Tailwind CSS 4** — Component library & styling
- **Vercel AI SDK** — Streaming chat UI components
- **Monaco Editor** — Code/file editing
- **xterm.js** — Web terminal
- **TanStack Query** — Server state management

### Backend
- **Node.js + Hono** — API server (lightweight, fast)
- **Drizzle ORM** — Type-safe database access
- **PostgreSQL** — Primary database (SQLite option for ultra-simple deploys?)
- **Redis** — Job queue, caching, pub/sub
- **BullMQ** — Automation scheduler
- **Better Auth** — Authentication (email/password, OAuth, magic link)

### AI Layer
- **LiteLLM Proxy** (Python sidecar) — Multi-model routing, BYOK support
  - OpenAI, Anthropic, Google, Ollama, Groq, Together, etc.
- **Tool execution** — Direct in workspace (single-user) or docker exec (multi-user)
- **AgentSkills** — Same format as OpenClaw/Zo

### Infrastructure
- **Caddy** — Reverse proxy with automatic TLS, wildcard certs
- **Docker Compose** — Deployment packaging
- **Docker Engine API** (multi-user only) — Container management via dockerode

### Channels
- **Telegram** — Bot API (config: `TELEGRAM_BOT_TOKEN`)
- **Email** — Inbound via webhook (Cloudflare Email Workers, Postal, or Mailgun)
- **Discord** — Bot API (config: `DISCORD_BOT_TOKEN`)
- **SMS** — Twilio (config: `TWILIO_*` keys) — optional

### Phone & Email Provisioning
Making this easy to add, not baked into the core:

**Email (handle@yourdomain.com):**
- Option A: Cloudflare Email Routing (free, recommended) — catch-all → webhook → Lex
- Option B: Postal (self-hosted SMTP) — more control, more setup
- Option C: Mailgun/Sendgrid inbound routes — managed, pay per use
- Config: `EMAIL_DOMAIN=yourdomain.com`, `EMAIL_PROVIDER=cloudflare|postal|mailgun`
- Each user auto-gets `handle@yourdomain.com`

**Phone (SMS):**
- Twilio — provision a number per instance (or per user in managed mode)
- Config: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Inbound SMS → webhook → Lex AI → response via SMS
- Optional: not required for the platform to work

**Approach:** Both are implemented as Channel plugins. The core platform works perfectly without either. Add them by filling in env vars — zero code changes needed.

## Data Model (Core Tables)

```sql
users
  id UUID PK
  email TEXT UNIQUE
  handle TEXT UNIQUE        -- becomes handle.lex.space
  name TEXT
  bio TEXT                  -- AI context about user
  avatar TEXT
  settings JSONB            -- misc preferences
  created_at TIMESTAMPTZ

conversations
  id UUID PK
  user_id UUID FK → users
  title TEXT
  persona_id UUID FK → personas (nullable)
  model TEXT                -- model override for this conversation
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

messages
  id UUID PK
  conversation_id UUID FK → conversations
  role TEXT                 -- user | assistant | system | tool
  content TEXT
  tool_calls JSONB          -- for assistant tool-use messages
  tool_results JSONB        -- for tool response messages
  model TEXT
  tokens_in INT
  tokens_out INT
  created_at TIMESTAMPTZ

personas
  id UUID PK
  user_id UUID FK → users
  name TEXT
  prompt TEXT
  is_default BOOLEAN
  created_at TIMESTAMPTZ

rules
  id UUID PK
  user_id UUID FK → users
  condition TEXT            -- optional: when to apply
  prompt TEXT               -- the instruction
  is_active BOOLEAN
  created_at TIMESTAMPTZ

automations
  id UUID PK
  user_id UUID FK → users
  name TEXT
  instruction TEXT          -- what the AI should do
  schedule TEXT             -- cron expression
  delivery TEXT             -- chat | email | telegram | sms
  model TEXT                -- optional model override
  is_active BOOLEAN
  last_run TIMESTAMPTZ
  next_run TIMESTAMPTZ
  created_at TIMESTAMPTZ

automation_runs
  id UUID PK
  automation_id UUID FK → automations
  status TEXT               -- running | completed | failed
  output TEXT
  error TEXT
  started_at TIMESTAMPTZ
  completed_at TIMESTAMPTZ

sites
  id UUID PK
  user_id UUID FK → users
  name TEXT
  slug TEXT                 -- becomes slug.sites.yourdomain.com
  framework TEXT            -- hono (default)
  is_published BOOLEAN
  custom_domain TEXT
  port INT                  -- internal port for the site process
  created_at TIMESTAMPTZ

integrations
  id UUID PK
  user_id UUID FK → users
  provider TEXT             -- gmail | calendar | notion | dropbox | etc
  label TEXT                -- "Personal Gmail", "Work Calendar"
  access_token TEXT (encrypted)
  refresh_token TEXT (encrypted)
  scopes TEXT[]
  permissions TEXT          -- read | readwrite
  created_at TIMESTAMPTZ
  expires_at TIMESTAMPTZ

api_keys
  id UUID PK
  user_id UUID FK → users
  key_hash TEXT             -- bcrypt hash of the key
  name TEXT
  last_used TIMESTAMPTZ
  created_at TIMESTAMPTZ

skills
  id UUID PK
  user_id UUID FK → users
  name TEXT
  description TEXT
  directory TEXT            -- path in workspace: skills/skill-name/
  created_at TIMESTAMPTZ
```

## Deployment: One Command

```bash
git clone https://github.com/lex-the-computer/lex
cd lex
cp .env.example .env
# Edit .env: set OPENAI_API_KEY (or ANTHROPIC_API_KEY, etc.)
# Optionally set domain, email config, Telegram token
docker compose up -d
# Visit http://localhost:3000 (or https://yourdomain.com if configured)
```

### .env.example
```bash
# === REQUIRED ===
# At least one AI provider key
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_AI_KEY=...

# === OPTIONAL: Domain & HTTPS ===
# DOMAIN=lex.yourdomain.com
# SITES_DOMAIN=sites.yourdomain.com
# SPACE_DOMAIN=space.yourdomain.com

# === OPTIONAL: Channels ===
# TELEGRAM_BOT_TOKEN=
# DISCORD_BOT_TOKEN=
# DISCORD_APP_ID=

# === OPTIONAL: Email ===
# EMAIL_DOMAIN=yourdomain.com
# EMAIL_PROVIDER=cloudflare  # cloudflare | postal | mailgun
# EMAIL_WEBHOOK_SECRET=

# === OPTIONAL: SMS ===
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_PHONE_NUMBER=

# === OPTIONAL: Multi-user ===
# MULTI_USER=false

# === OPTIONAL: Local AI (Ollama) ===
# OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### Minimum Viable Deploy
Just need ONE thing: an AI API key. Everything else is optional.
- No domain needed (runs on localhost:3000)
- No email/SMS needed
- No Telegram needed
- PostgreSQL + Redis included in the Docker Compose
- Works on any machine that can run Docker

### Recommended VPS Specs
- **Personal (1 user)**: 2 vCPU, 4GB RAM, 40GB storage — ~$20/mo
- **Team (5-10 users)**: 4 vCPU, 8GB RAM, 100GB storage — ~$40/mo
- **With local AI (Ollama)**: Add GPU or use 8GB+ RAM for small models

## Security Model

### Single-User Mode
- Auth is optional (can be disabled for local/private network use)
- Workspace sandboxing: AI operations restricted to /data/workspace/
- Shell commands run as non-root user inside the container
- No network isolation needed (single user owns everything)

### Multi-User Mode
- Auth required (Better Auth with email/password + OAuth)
- Container isolation: each user's code runs in isolated Docker container
- Network policies: containers can't access platform internals
- Resource limits: CPU, memory, storage per container
- File access: users can only access their own workspace

### Both Modes
- API auth: Bearer tokens + session cookies
- Rate limiting: per-user request limits
- Input validation: all user input sanitized
- Secrets encrypted at rest (integrations, API keys)
- HTTPS by default when domain configured (Caddy auto-cert)
