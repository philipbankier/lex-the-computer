# Codex Task: Lex the Computer — Phase 0: Scaffolding & Infrastructure

## Overview
Build the foundational monorepo, auth, database, Docker Compose, and app shell for **Lex** — an open-source personal AI cloud computer (Zo Computer clone). This phase produces a bootable app with login, the full UI layout, and empty page shells for all features.

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — full system architecture, tech stack, data model
- `PLAN.md` — implementation plan with all phases
- `UI-AUDIT.md` — comprehensive live audit of Zo Computer's actual UI
- `RESEARCH.md` — complete feature map

## Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend**: Hono (Node.js), TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Cache/Queue**: Redis
- **AI Proxy**: LiteLLM (Python sidecar)
- **Reverse Proxy**: Caddy
- **Monorepo**: pnpm workspaces + Turborepo
- **Auth**: Better Auth (email/password)
- **Deployment**: Docker Compose

## Deliverables

### 1. Monorepo Structure
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
├── packages/
│   ├── web/          # Next.js 15
│   ├── core/         # Hono API
│   └── shared/       # Shared types
├── deploy/
│   ├── caddy/Caddyfile
│   └── litellm/config.yaml
└── docs/
```

### 2. Database Schema (Drizzle ORM)
Implement ALL tables from ARCHITECTURE.md:
- `users` (id, email, handle, name, bio, avatar, settings, created_at)
- `conversations` (id, user_id, title, persona_id, model, created_at, updated_at)
- `messages` (id, conversation_id, role, content, tool_calls, tool_results, model, tokens_in, tokens_out, created_at)
- `personas` (id, user_id, name, prompt, is_default, created_at)
- `rules` (id, user_id, condition, prompt, is_active, created_at)
- `automations` (id, user_id, name, instruction, schedule, delivery, model, is_active, last_run, next_run, created_at)
- `automation_runs` (id, automation_id, status, output, error, started_at, completed_at)
- `sites` (id, user_id, name, slug, framework, is_published, custom_domain, port, created_at)
- `integrations` (id, user_id, provider, label, access_token, refresh_token, scopes, permissions, created_at, expires_at)
- `api_keys` (id, user_id, key_hash, name, last_used, created_at)
- `skills` (id, user_id, name, description, directory, created_at)
- `secrets` (id, user_id, key, value_encrypted, created_at)
- `datasets` (id, user_id, name, description, path, created_at)

### 3. Auth
- Better Auth with email/password signup + login
- Session management (cookies)
- Protected routes (redirect to login if not authenticated)
- Simple signup → login → redirect to app flow

### 4. Docker Compose
```yaml
services:
  web:        # Next.js frontend (port 3000)
  core:       # Hono API server (port 3001)
  postgres:   # PostgreSQL 16
  redis:      # Redis 7
  litellm:    # LiteLLM proxy (port 4000)
  caddy:      # Reverse proxy (ports 80, 443)
```
- `docker compose up` should boot everything
- Health checks on all services
- Volume mounts for postgres data, redis data, workspace
- `.env.example` with all config vars documented

### 5. App Layout & UI Shell

**CRITICAL: This is a tab-based UI, NOT page-based navigation.**

Each nav click opens a new **closeable tab** at the top of the content area (like browser tabs within the app). Multiple tabs can be open simultaneously.

#### Sidebar (left, collapsible)
Primary items (always visible):
- **Home** — icon + label, links to dashboard
- **Files** — opens Files tab
- **Search** — opens search modal/overlay (NOT a tab)
- **Chats** — opens Chats tab
- **Automations** — opens Automations tab
- **Space** — opens Space tab
- **Skills** — opens Skills tab

**More** menu (expandable section):
- **Hosting** — opens Hosting tab
- **Datasets** — opens Datasets tab
- **System** — opens System tab
- **Terminal** — opens Terminal tab
- **Billing** — opens Billing tab
- **Resources** — opens Resources tab
- **Bookmarks** — opens Bookmarks tab
- **Settings** — opens Settings tab

#### Tab Bar (top of content area)
- Shows open tabs with names
- Each tab has a close button
- Clicking a tab switches to it
- Active tab is highlighted

#### Persistent Chat Sidebar (right, collapsible)
Available on EVERY page (not just Chats):
- "New chat" button
- "Expand chat" / "Collapse chat sidebar" buttons
- Message input with placeholder "What can I do for you?"
- Active persona shown with avatar
- Model selector dropdown
- "Browse files" button
- "Send" / "Go" button
- Footer: user's domain, space URL, email, phone (placeholder values for now)

#### Command Palette
- Cmd+K opens "Command Palette" overlay: "Search for a command to run..."
- Separate "Go to File" overlay: "Search for files by name"

### 6. Page Shells (empty but navigable)

Each page should be a functional tab with appropriate header/toolbar, but content can be placeholder:

**Home/Dashboard:**
- "Bookmarks" heading
- "Quick access to your bookmarked tabs and recent files"
- Quick action buttons (New Chat, Upload File, etc.)

**Files:**
- Toolbar: Upload, Search files, View options, Create new item, Open trash
- Empty file tree area
- Sort by Name column header

**Chats:**
- Left panel: conversation list (empty)
- Filter conversations button, New button
- Right panel: active conversation area

**Automations:**
- "New agent" button
- Filter tabs: None | Email | SMS | Telegram | Paused
- Empty list area

**Space:**
- URL display: handle.lex.space
- Buttons: New page, Open in new tab, Refresh, Share, Make private
- Route dropdown
- Preview iframe area (empty)

**Skills:**
- Two tabs: Installed | Hub
- Installed: "Open folder" button, "Create skill" button
- Hub: Search bar, sort button, empty grid

**Hosting:**
- "New Site" button + "More create options"
- Search bar
- Empty site list

**Datasets:**
- "Create dataset" button
- Description text
- Empty list

**System:**
- Sub-tabs: Stats | Restore | Reboot
- Stats: placeholder for CPU, RAM, uptime, etc.

**Terminal:**
- Placeholder for xterm.js (just a dark background for now)

**Settings:**
- 5 tabs: AI | Channels | Integrations | UX | Advanced
- **AI tab**: sections for Models, Personas, Providers, Personalization, Rules (empty forms)
- **Channels tab**: sections for Text, Email, Telegram (placeholder config)
- **Integrations tab**: sub-tabs Connections | Browser | Payments with integration cards
- **UX tab**: Theme picker (Light/Dark/System + placeholder named themes), Keybindings button, Show hidden files toggle
- **Advanced tab**: Secrets (key/value form), Access Tokens (create form), Danger Zone (delete account)

### 7. API Shell (Hono)
Basic route stubs that return 501 Not Implemented:
```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session

GET  /api/conversations
POST /api/conversations
GET  /api/conversations/:id
DELETE /api/conversations/:id

POST /api/chat          (will be SSE streaming later)

GET  /api/files/*
POST /api/files/upload
DELETE /api/files/*

GET  /api/automations
POST /api/automations
GET  /api/automations/:id

GET  /api/sites
POST /api/sites

GET  /api/skills
GET  /api/skills/hub

GET  /api/settings
PUT  /api/settings

GET  /api/system/stats
```

### 8. Development Setup
- `pnpm dev` runs web + core in parallel (turborepo)
- Hot reload on both frontend and backend
- Database migrations run on startup
- Seed script for development (creates test user)

## Acceptance Criteria
1. `docker compose up` → all services start → visit localhost:3000 → see login page
2. Can sign up with email/password → redirected to app
3. App shell visible: sidebar with all nav items, tab system works
4. Can click every nav item → opens as a tab → shows page shell
5. Multiple tabs can be open simultaneously, can close tabs
6. Chat sidebar visible on right side of every page
7. Settings page has all 5 tabs with sub-sections
8. Command palette opens with Cmd+K
9. Mobile responsive (sidebar collapses to bottom nav)
10. `pnpm dev` works for local development without Docker
11. All Drizzle migrations run cleanly
12. API routes return 501 stubs (confirming routing works)
13. No TypeScript errors, no lint errors

## Style Guidelines
- Use shadcn/ui components exclusively (Button, Card, Tabs, Dialog, Sheet, etc.)
- Tailwind CSS 4 for custom styling
- Dark mode support from day one (use CSS variables)
- Geist font (or Inter) as default
- Clean, minimal aesthetic matching Zo's design language
- Responsive: works on mobile (sidebar → bottom nav) and desktop
