# Lex the Computer — Implementation Plan (v2)

## Project Overview
**Lex** is an open-source personal AI cloud computer. Deploy it with one command and get a Zo Computer-like experience: AI chat with @ mentions, file storage, automations, site hosting, a Skills marketplace, multi-channel access, and more — all self-hosted, fully open source.

**Repository**: `lex-the-computer` (monorepo)
**License**: MIT
**Tagline**: "Your personal AI computer. One command to deploy."

## Build Order: Strictly Sequential
No parallel work. Each phase is completed, reviewed, and verified before the next begins.

---

## Phase 0: Scaffolding & Infrastructure
**Codex Task 1 | Goal: Bootable app with auth + database + Docker Compose**

- [ ] Initialize pnpm monorepo + turborepo
- [ ] `packages/web`: Next.js 15 + App Router + Tailwind 4 + shadcn/ui
- [ ] `packages/core`: Hono API server + TypeScript
- [ ] `packages/shared`: Shared types + constants
- [ ] PostgreSQL + Drizzle ORM: full schema (all tables from ARCHITECTURE.md)
- [ ] Redis setup
- [ ] Better Auth: email/password signup + login + session management
- [ ] Docker Compose: web + core + postgres + redis + litellm
- [ ] `docker compose up` boots and shows login page
- [ ] **Tab-based UI system** (NOT page-based — each section opens as a closeable tab, like browser tabs)
- [ ] App layout shell — sidebar with nav items:
  - Primary: Home, Files, Search (modal), Chats, Automations, Space, Skills
  - More menu (expandable): Hosting, Datasets, System, Terminal, Billing, Resources, Bookmarks, Settings
- [ ] **Persistent chat sidebar** on right side of every page (collapsible)
- [ ] Settings page shell with 5 tabs: AI | Channels | Integrations | UX | Advanced
- [ ] CI: lint + type-check + build
- [ ] `.env.example` with all configuration options documented

**Acceptance**: `docker compose up` → login → see app shell with sidebar. All nav items present (empty pages OK).

---

## Phase 1: Chat — The Core Experience
**Codex Task 2 | Goal: Full-featured AI chat comparable to Zo**

- [ ] Chat UI: message list with streaming, markdown rendering, code blocks
- [ ] Message input with @ mention support (files + tools)
- [ ] @ files: type @ → shows file picker → selected file content added to context
- [ ] @ tools: type @ → shows tool list → explicitly invokes tool
- [ ] Vercel AI SDK integration for streaming responses
- [ ] LiteLLM proxy configuration + client wrapper
- [ ] Conversation CRUD: create, list, rename, delete
- [ ] Conversation sidebar with search
- [ ] Model picker dropdown (fetches available models from LiteLLM)
- [ ] System prompt builder: assembles bio + active persona + active rules + available tools
- [ ] User bio / profile page (name, bio text, avatar upload)
- [ ] Personas CRUD: create, edit, delete, set active
- [ ] Persona switcher in chat header
- [ ] Rules CRUD: condition (optional) + prompt, toggle active/inactive
- [ ] BYOK settings: add API keys per provider → updates LiteLLM config
- [ ] AI model settings page: list models, configure defaults
- [ ] Tool results display in chat (expandable tool call + result)
- [ ] Basic AI tools: web search (Brave/Serper), read webpage, save webpage
- [ ] Conversation title auto-generation (AI summarizes first message)
- [ ] Chat keyboard shortcuts (Cmd+Enter to send, Cmd+N new chat)

**Acceptance**: Can have multi-turn streaming conversations. Switch models, personas. @ mention files/tools. Rules affect AI behavior. BYOK works.

---

## Phase 2: Files & Workspace
**Codex Task 3 | Goal: Full file management + AI file manipulation + terminal**

- [ ] Workspace directory structure: `/data/workspace/{files,sites,skills,articles,.config}`
- [ ] File browser UI: tree view sidebar + main content area
- [ ] Breadcrumb navigation
- [ ] Grid view + list view toggle
- [ ] Upload: drag & drop zone, multi-file, progress indicator
- [ ] Download files (single + folder as zip)
- [ ] File viewer: auto-detect type → render appropriately
  - Text/code: Monaco editor with syntax highlighting
  - Markdown: rendered preview with raw toggle
  - Images: preview with zoom
  - PDF: embedded PDF viewer
  - Audio: playback
  - Video: playback
- [ ] File operations: rename, move, copy, delete, new folder, new file
- [ ] File search: content search (ripgrep) + filename search
- [ ] "Chat about this file" button → opens chat with file in context
- [ ] AI tools: `read-file`, `create-file`, `edit-file`, `list-files`, `search-files`
- [ ] AI tool: `run-command` (shell exec in workspace, sandboxed to workspace dir)
- [ ] AI tool: `run-parallel-commands`, `run-sequential-commands`
- [ ] AI tool: `save-webpage` (URL → markdown → saves to articles/ folder)
- [ ] Web terminal: xterm.js → WebSocket → shell session in workspace
- [ ] Terminal page in sidebar nav
- [ ] Split view option: terminal + file editor

- [ ] Show hidden files toggle (developer mode)

**Acceptance**: Browse, upload, edit files. AI reads/writes files via tools. Terminal works. Save webpage tool saves articles.

---

## Phase 3: Automations
**Codex Task 4 | Goal: Cron-scheduled AI tasks with delivery**

- [ ] BullMQ setup: repeatable jobs, retry logic, dead letter queue
- [ ] Automation CRUD API + UI (list view with cards)
- [ ] Automation form: name, instruction, schedule, delivery method, model override
- [ ] Visual cron picker component (daily/weekly/monthly/custom)
- [ ] One-time future scheduling option
- [ ] Automation execution engine:
  - Creates isolated conversation context
  - Runs AI with instruction + full user context (bio, rules, personas)
  - AI has access to ALL tools (files, web, shell, integrations)
  - Saves output to automation_runs table
- [ ] Delivery methods:
  - Save to dedicated automation conversation in chat
  - Send notification email
  - Send Telegram message (if configured)
- [ ] Automation run history: list runs, view output, view errors
- [ ] Automation status: active/paused toggle
- [ ] AI tools: `create-automation`, `edit-automation`, `delete-automation`, `list-automations`
- [ ] Claude Code / Codex / Gemini CLI as additional AI providers
  - Settings page to enable + configure
  - Model picker shows these as options

**Acceptance**: Create automation via UI or chat. It runs on schedule. Results delivered. Run history viewable. External AI providers configurable.

---

## Phase 4: Sites & Services
**Codex Task 5 | Goal: Create, edit, and host websites**

- [ ] Site creation: AI scaffolds Hono + Bun project in workspace/sites/
- [ ] Site template with standard structure:
  - `index.tsx` (main code), `package.json`, `CLAUDE` (AI instructions)
  - `zosite.json` → `lexsite.json` (site config)
- [ ] Site runner service: manages Bun processes per site
  - Start, stop, restart
  - Port allocation
  - Process health monitoring
- [ ] Site editor: Monaco split view (code left, live preview iframe right)
- [ ] Site preview: authenticated iframe showing running site
- [ ] Site publish: Caddy dynamic config adds public route
  - URL: `sitename.sites.yourdomain.com`
- [ ] Unpublish: removes public access, keeps site running privately
- [ ] Custom domain support:
  - CNAME → Caddy auto-TLS
  - Domain status: Pending CNAME → Pending SSL → Active
- [ ] Per-site SQLite database:
  - Auto-detected when site uses SQLite
  - Built-in SQLite browser/explorer in UI
- [ ] AI tools: `create-site`, `publish-site`, `unpublish-site`
- [ ] AI can edit site files directly via file tools
- [ ] Service management:
  - Register HTTP/TCP services on custom ports
  - Service list + status in Sites tab → Services sub-tab
  - Public URLs (HTTP proxy + direct tunnel)
  - Service diagnostics tool
  - Environment variables per service
- [ ] AI tools: `register-service`, `update-service`, `delete-service`, `list-services`, `diagnose-service`
- [ ] Proxy local service (ngrok-like tunneling via Caddy)

- [ ] **Secrets/env vars manager** in Settings → Advanced
  - Key-value pairs available to sites/scripts
  - Support pasting .env file contents
  - Description: "Environment variables available when running scripts and routes"

**Acceptance**: Create site via chat, edit code, see live preview. Publish → public URL works. Services run with public endpoints. Secrets configurable.

---

## Phase 5: Space (Personal Domain)
**Codex Task 6 | Goal: Quick personal web presence**

- [ ] Space page in sidebar nav
- [ ] Route system:
  - **Pages**: React components (Tailwind CSS, Lucide icons, stateful)
  - **API endpoints**: Backend handlers returning data
- [ ] Space editor UI: route list + code editor
- [ ] Route CRUD: create page, create API, edit, delete
- [ ] Public/private toggle per page (pages private by default)
- [ ] API endpoints always public
- [ ] Asset uploads: images/files as public assets
- [ ] Asset management: list, upload, delete assets
- [ ] Version history per route: undo/redo
- [ ] Route history viewer (see all past versions)
- [ ] Error checking: view recent errors from routes
- [ ] Site settings: global space settings
- [ ] Subdomain: `handle.space.yourdomain.com`
- [ ] AI tools: `create-space-route`, `edit-space-route`, `delete-space-route`, `list-space-routes`, `get-space-route`, `get-space-route-history`, `undo-space-route`, `redo-space-route`, `upload-space-asset`, `delete-space-asset`, `list-space-assets`, `get-space-errors`, `get-space-settings`, `update-space-settings`, `restart-space-server`

**Acceptance**: Create pages and APIs on personal space. Public URL works. Undo/redo works. Assets uploadable.

---

## Phase 6: Skills (Agent Capabilities) ⭐
**Codex Task 7 | Goal: Full skills system with marketplace hub**

- [ ] Skills as **top-level nav item** (between Space and Menu)
- [ ] Skills page with two tabs:
  - **Installed**: shows locally installed skills as cards
  - **Hub**: community marketplace (browse, search, install)
- [ ] Skill card component:
  - Name, author/publisher tag, description (truncated)
  - Install/Uninstall button
  - Icon/logo (optional)
- [ ] **Create Skill** button → wizard or opens chat with skill-creator context
- [ ] **Open Folder** button → navigates to Skills directory in file browser
- [ ] **Documentation** link → opens skill docs
- [ ] AgentSkills format compliance:
  - `Skills/<skill-name>/SKILL.md` with frontmatter (name, description, compatibility, metadata, allowed-tools)
  - Optional: `scripts/`, `references/`, `assets/` subdirectories
- [ ] Progressive skill loading in AI:
  - Metadata (frontmatter) always in context
  - Full SKILL.md loaded only when task matches description
  - Referenced files loaded on demand
- [ ] AI tool: `create-skill` — creates new skill directory + SKILL.md
- [ ] AI can build custom integrations as Skills (same as Zo)
- [ ] Skills Hub backend:
  - Registry API: list, search, get skill details
  - Skill packages: download from GitHub repo or registry
  - Version tracking
- [ ] Skill installation flow:
  - Click Install → downloads to Skills/ directory
  - Skill immediately available to AI
- [ ] Skill uninstall: removes from Skills/ directory
- [ ] Skills search (in Hub): by name, description, author
- [ ] Community submission flow: link to GitHub repo for PRs
- [ ] Built-in starter skills:
  - Brainstorming Expert
  - Skill Creator
  - GitHub (gh CLI)
  - Web Researcher
  - Code Reviewer

**Acceptance**: Skills page shows installed + hub. Can install/uninstall from hub. Can create skills. AI uses skills when tasks match.

---

## Phase 7: Integrations & API
**Codex Task 8 | Goal: Third-party connections + public API**

- [ ] OAuth2 flow framework (generic handler using `arctic` library)
- [ ] Integration settings page: connect, manage, disconnect
- [ ] Per-integration permission model: Read Only vs Read & Write
- [ ] Multiple accounts per integration (e.g., personal + work Gmail)
- [ ] Gmail integration:
  - Read: search, view emails
  - Write: send emails from user's Gmail
- [ ] Google Calendar integration:
  - Read: search, view events
  - Write: create, edit events
- [ ] Notion integration:
  - Read: search, read pages
  - Write: create, edit pages
- [ ] Google Drive integration:
  - Read: search, download files
  - Write: upload files
- [ ] Dropbox integration:
  - Read: search, download files
  - Write: upload files
- [ ] Linear integration:
  - Read: search, view issues
  - Write: create, edit issues
- [ ] GitHub integration:
  - Connect GitHub account
  - AI can access repos, issues, PRs
- [ ] AI tools for each: `use-gmail`, `use-calendar`, `use-notion`, `use-drive`, `use-dropbox`, `use-linear`
- [ ] `list-app-tools` — shows available tools for connected integrations
- [ ] Public REST API:
  - POST `/api/ask` — send message, get response (with streaming option)
  - GET `/api/models/available` — list models
  - GET `/api/personas/available` — list personas
  - `conversation_id` for multi-turn threading
  - `model_name` override
  - `persona_id` override
  - `output_format` for structured JSON output
- [ ] API key management UI: create, name, revoke, list, last-used timestamp
- [ ] API auth: Bearer token validation middleware

**Acceptance**: Can connect Gmail, Calendar, Notion. AI uses them via tools. Public API works with API keys. Structured output supported.

---

## Phase 8: Channels (Multi-Surface Access)
**Codex Task 9 | Goal: Access Lex from Telegram, email, Discord**

- [ ] Channel plugin architecture:
  - Common interface: receive message → AI conversation → send response
  - Plugin registration: auto-enable when env vars present
- [ ] Telegram bot:
  - Receive text messages → create/continue conversation → respond
  - File attachments (send + receive)
  - Pairing flow (connect Telegram from settings)
- [ ] Email channel:
  - Per-user email: `handle@yourdomain.com`
  - Inbound: webhook → parse → AI conversation → respond via email
  - Outbound: AI can send emails to user
  - Configurable: Cloudflare Email Workers, Postal, or Mailgun
- [ ] Discord bot:
  - Receive messages → AI conversation → respond
  - File attachments
- [ ] SMS channel (optional):
  - Twilio integration
  - Inbound SMS → AI → respond via SMS
- [ ] Channel settings UI:
  - Connect/disconnect each channel
  - Test send for each
  - View connected channels status
- [ ] Per-channel persona support (different persona for Telegram vs email)
- [ ] AI tools: `send-email`, `send-telegram`, `send-discord`, `send-sms`
- [ ] Notification delivery for automations via channels

**Acceptance**: Send message via Telegram → get AI response. Email inbound works. Discord works. Per-channel personas work.

---

## Phase 9: Onboarding & Polish
**Codex Task 10 | Goal: Zo-quality first-run experience + production UX**

- [ ] Multi-step onboarding wizard (see ONBOARDING-FLOW.md):
  1. Welcome screen
  2. Profile setup (name, bio, interests, social links)
  3. Persona picker (grid of cards)
  4. First automation suggestion (daily briefing, etc.)
  5. Channel setup (Telegram, show provisioned email)
  6. Ready screen (Space URL, email, quick action buttons)
- [ ] Post-onboarding first chat: AI greets with bio context, confirms automation
- [ ] Dashboard home page:
  - Recent conversations
  - Upcoming/recent automation runs
  - Quick actions (New Chat, Upload File, Create Site, Create Automation)
  - Storage usage indicator
- [ ] Mobile responsive design (all pages, all components)
- [ ] Theme system: Light, Dark, System + 15-20 named themes (like Zo's Espreszo, Claude Zo, etc.)
- [ ] Configurable keybindings (Settings → UX → Configure shortcuts)
- [ ] Keyboard shortcuts:
  - Cmd+K: command palette
  - Cmd+N: new conversation
  - Cmd+Enter: send message
- [ ] Global search: conversations, files, automations, skills
- [ ] Loading states for all async operations
- [ ] Error boundaries + friendly error pages
- [ ] Empty states for all list views (conversations, files, automations, etc.)
- [ ] Toast notifications for async operations (automation completed, etc.)
- [ ] Notification center (in-app notifications from automations, channels)
- [ ] **Datasets** feature:
  - Create dataset from messy exports (CSV, JSON, etc.)
  - DuckDB backend (datapackage.json + schema.yaml + data.duckdb)
  - Dataset explorer UI: browse tables, run queries, build charts
  - AI can analyze datasets and discover patterns
- [ ] **System page** (under More menu):
  - Stats: CPU, RAM, processes, uptime, architecture, storage
  - Network speed test
  - Reboot server button
- [ ] README.md: project description, screenshots, quick start, architecture overview
- [ ] SETUP.md: detailed self-hosting guide
- [ ] CONTRIBUTING.md: how to contribute

**Acceptance**: New user can go from signup → onboarding → first useful conversation in <3 minutes. All pages responsive. Dark mode works. No broken empty states.

---

## Phase 10: Advanced Features
**Codex Task 11 | Goal: Power features + AI browser + MCP**

- [ ] AI Browser:
  - Playwright integration (headless browser)
  - AI tool: `open-webpage` (browser-based, not just fetch)
  - Settings: user can log into sites in AI's browser
  - AI can interact with logged-in sites (read feeds, click buttons)
- [ ] MCP Server:
  - Expose all Lex tools via Model Context Protocol
  - HTTP endpoint: `/mcp`
  - Config examples for: Claude Code, Cursor, Gemini CLI, Zed, OpenCode
  - Auth: API key in Authorization header
- [ ] Image generation tool (DALL-E, Stability AI)
- [ ] Image editing tool (AI-powered image remix)
- [ ] Audio transcription tool (Whisper)
- [ ] Video transcription tool
- [ ] Video generation from image (short clips)
- [ ] Diagram generation (D2 diagrams)
- [ ] Google Maps search tool
- [ ] SSH connectivity:
  - SSH from Lex to other machines
  - SSH keys management
  - SSH config in terminal
- [ ] Airtable integration (moved if not done in Phase 7)
- [ ] Spotify integration
- [ ] OneDrive integration
- [ ] Google Tasks integration
- [ ] Microsoft Outlook integration

**Acceptance**: AI can browse logged-in sites. MCP endpoint works with Claude Code. Image gen, transcription, diagram tools work.

---

## Phase 11: Commerce & Multi-User
**Codex Task 12 | Goal: Selling + multi-user + production hardening**

- [ ] Stripe Connect integration:
  - Connect Stripe account (OAuth flow)
  - Create products (name, description, price)
  - Create payment links
  - Order management (view, fulfill, export CSV)
  - 0% platform fee
  - Embed payment links in Sites
- [ ] AI tools: `create-stripe-product`, `create-stripe-price`, `create-stripe-payment-link`, `update-stripe-payment-link`, `list-stripe-payment-links`, `list-stripe-orders`, `update-stripe-orders`
- [ ] Sell tab in settings/menu
- [ ] Multi-user mode (`MULTI_USER=true`):
  - Container provisioning via dockerode
  - Container base image: Debian + Node + Bun + Python + common tools
  - Tool execution routing: direct fs ops → docker exec
  - User resource limits (CPU, memory, storage)
  - Container lifecycle: create on signup, start on use, stop on idle
- [ ] Usage metering: token counting per user, storage tracking
- [ ] Rate limiting per user
- [ ] Admin dashboard: user management, system stats, resource usage
- [ ] Health check endpoints (`/health`, `/ready`)
- [ ] Monitoring: structured logging, error tracking
- [ ] Backup/restore scripts
- [ ] One-line deploy script
- [ ] Docker Hub image publishing (lex-the-computer/lex:latest)
- [ ] Landing page for the project

**Acceptance**: Stripe Connect works. Multi-user mode isolates users. Admin dashboard shows stats. Backup/restore works.

---

## Phase 12: Desktop App
**Codex Task 13 | Goal: Native desktop app with file sync**

- [ ] Tauri v2 app wrapping web UI
- [ ] File sync: select local folder → bidirectional sync with Lex workspace
- [ ] SyncThing integration as alternative sync method
- [ ] Mac + Windows + Linux builds
- [ ] Auto-update mechanism
- [ ] System tray icon with quick actions

**Acceptance**: Desktop app opens, shows full Lex UI. File sync works between local folder and Lex workspace.

---

## Monorepo Structure

```
lex/
├── README.md
├── LICENSE (MIT)
├── docker-compose.yml
├── docker-compose.dev.yml
├── Dockerfile
├── .env.example
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
│
├── packages/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── app/
│   │   │   ├── (auth)/         # Login, signup, onboarding
│   │   │   └── (app)/          # Main app (chat, files, sites, automations, space, skills, settings, terminal)
│   │   ├── components/         # UI components per feature
│   │   ├── hooks/              # Custom hooks
│   │   └── lib/                # Utilities
│   │
│   ├── core/                   # Hono API server
│   │   ├── src/
│   │   │   ├── routes/         # API routes per feature
│   │   │   ├── services/       # Business logic
│   │   │   ├── tools/          # 60+ AI tool definitions
│   │   │   ├── db/             # Drizzle schema + migrations
│   │   │   ├── lib/            # Config, auth, LiteLLM client
│   │   │   └── middleware/     # Auth, rate limiting
│   │   └── package.json
│   │
│   └── shared/                 # Shared types, constants, tool definitions
│
├── container/                  # User container image (multi-user mode)
├── desktop/                    # Tauri desktop app
├── docs/                       # All documentation
└── deploy/                     # Caddy, LiteLLM config, scripts
```

---

## Codex Handoff Strategy

1. Each phase = one Codex task
2. Task includes: description, acceptance criteria, reference to ARCHITECTURE.md + PLAN.md + RESEARCH.md
3. I review each phase's output against acceptance criteria
4. Fix issues before proceeding to next phase
5. **No parallel phases** — sequential only
6. Estimated: 13 Codex tasks, one at a time

## Success Criteria (Full Project)
- [ ] `docker compose up` → working app in under 5 minutes
- [ ] Non-technical user can deploy with setup guide
- [ ] Feature parity with Zo for all Phase 0-10 features
- [ ] Skills marketplace with hub + install/create
- [ ] Works on a $20/month VPS (2 vCPU, 4GB RAM) for single user
- [ ] Clean, responsive UI comparable to Zo
- [ ] All 60+ AI tools implemented and working
- [ ] MCP server endpoint for external AI tool access
- [ ] Comprehensive documentation
