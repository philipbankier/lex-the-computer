# Codex Task: Lex the Computer — Phase 9: Onboarding & Polish

## Overview
Build the **onboarding wizard**, **dashboard home page**, **theme system**, **datasets**, **system page**, and polish the entire UX for production quality. This phase transforms Lex from a functional tool into a polished product.

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — system architecture
- `PLAN.md` — Phase 9 section
- `ONBOARDING-FLOW.md` — detailed onboarding wizard spec
- `UI-AUDIT.md` — Zo Computer's UX patterns

## What Already Exists (Phases 0–8 complete)
- Full monorepo with all core features: chat, files, automations, sites, space, skills, integrations, channels
- Tab-based UI, settings with all tabs, sidebar nav
- Auth (signup/login), personas, rules, BYOK

## Phase 9 Requirements

### 1. Onboarding Wizard

Multi-step wizard shown after first signup (check `users.onboardingCompleted` flag).

**Database additions:**
```typescript
// Add to users table
onboardingCompleted: boolean default false

// User profile (extend or create)
user_profiles: {
  id: uuid primaryKey
  userId: uuid references users
  displayName: text
  bio: text
  interests: text[]
  socialLinks: jsonb           // { twitter, github, linkedin, website }
  avatarUrl: text
  updatedAt: timestamp
}
```

**Step 1: Welcome**
- "Welcome to Lex" with logo/icon
- "Your personal AI cloud computer"
- Animated entrance (subtle fade in)
- [Get Started] button

**Step 2: Profile Setup**
- Name input
- "What you do" (bio textarea)
- Interests / focus areas (tag input — type + enter to add tags)
- Social links (optional collapsible: Twitter, GitHub, LinkedIn, Website)
- "This helps Lex personalize responses for you"

**Step 3: Choose Persona**
- Grid of persona cards (clickable, highlight selected):
  - **Default** — "Balanced, helpful, concise"
  - **Creative** — "Imaginative, exploratory, verbose"
  - **Technical** — "Precise, code-oriented, minimal"
  - **Casual** — "Friendly, conversational, emoji-friendly"
  - **Custom** — "Write your own" (expands textarea)
- Creates the selected persona in DB

**Step 4: First Automation**
- "Lex can work for you even when you're away"
- Suggestion cards:
  - 📰 Daily news briefing — "What topics interest you?" input
  - 📧 Morning email summary — "Which email?" (from connected Gmail or email)
  - 📅 Daily calendar preview — "Summarize your day ahead"
  - 🔔 Website monitor — "URL to watch" input
  - ⏭️ Skip for now
- Delivery method selector: Chat / Email / Telegram
- Schedule: default "Every morning at 8am" with time picker
- Actually creates the automation in DB if selected

**Step 5: Connect Channels** (optional)
- Cards for available channels (Telegram, Email, Discord)
- Email: auto-shows provisioned address
- Telegram/Discord: connect buttons (start pairing flow inline)
- "Skip for now" option

**Step 6: Ready!**
- "Your computer is ready 🖥️"
- Space URL display
- Email address display
- Quick action buttons:
  - [Start Chatting] → navigates to chat
  - [Upload Files] → navigates to files
  - [Build a Site] → navigates to sites
  - [Explore Settings] → navigates to settings
- Sets `onboardingCompleted = true`

**Post-onboarding first chat:**
- AI auto-sends greeting using profile context
- "Hey [name]! I'm Lex, your personal AI computer. I've set up your [automation] — it'll run every morning at 8am. What would you like to work on?"

### 2. Dashboard Home Page

Replace the Home tab shell with a real dashboard:

**Layout:**
- Welcome header: "Good [morning/afternoon/evening], [name]"
- 4-column grid of quick action cards:
  - 💬 New Chat
  - 📁 Upload File
  - 🌐 Create Site
  - ⚡ Create Automation
- Recent Conversations section (last 5, clickable)
- Upcoming Automations section (next 3 scheduled runs)
- Recent Automation Runs section (last 3 with status)
- Storage usage indicator (bar showing used/total)
- Connected channels status (icons with green/gray dots)

### 3. Theme System

**Database:**
```typescript
// Add to user_settings or create theme preference
// Store in existing settings/preferences
theme_preference: text default 'system'  // 'light', 'dark', 'system', or named theme
```

**Implementation:**
- CSS custom properties (CSS variables) for all colors
- Theme definitions as JSON objects mapping variable names to values
- Theme switcher in Settings → UX tab
- System/Light/Dark base toggle
- 20 named themes (inspired by Zo but original names):

1. **Midnight** — deep dark blue
2. **Snowfall** — bright white, cool blue accents
3. **Forest** — dark green, earthy tones
4. **Sunset** — warm oranges and reds on dark
5. **Ocean** — deep blue, teal accents
6. **Lavender** — soft purple, light background
7. **Espresso** — warm brown, coffee tones
8. **Neon** — dark with bright neon accents (cyan, magenta)
9. **Slate** — cool gray, minimal
10. **Rose** — soft pink, warm
11. **Arctic** — icy blue, white
12. **Ember** — dark with orange/red accents
13. **Sage** — muted green, calm
14. **Mocha** — dark brown, cream accents
15. **Cobalt** — rich blue, professional
16. **Peach** — warm, light peachy tones
17. **Graphite** — dark charcoal, sharp
18. **Mint** — fresh green, light
19. **Dusk** — purple-blue twilight
20. **Sand** — warm beige, desert tones

Each theme defines: background, foreground, card, border, primary, secondary, accent, muted, destructive colors + their foreground variants.

**Theme preview:** small color swatch circles shown in the picker grid.

### 4. Mobile Responsive Design

Ensure ALL pages work on mobile (320px–768px):
- Sidebar: collapses to hamburger menu on mobile
- Tab bar: horizontal scroll on mobile
- Chat: full-width, input at bottom
- File browser: single column, no tree sidebar (toggle)
- Settings: stacked tabs (vertical on mobile)
- All modals: full-screen on mobile
- Touch-friendly: minimum 44px tap targets
- No horizontal scroll anywhere

### 5. Datasets Feature

**Database:**
```typescript
datasets: {
  id: uuid primaryKey
  userId: uuid references users
  name: text not null
  description: text
  source: text                  // original filename or URL
  schema: jsonb                 // column definitions
  rowCount: integer
  filePath: text not null       // path to DuckDB file
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Backend:**
- `POST /api/datasets` — create dataset from uploaded CSV/JSON/Excel file
  - Parse file, infer schema, load into DuckDB
  - Save DuckDB file to workspace/datasets/
- `GET /api/datasets` — list datasets
- `GET /api/datasets/:id` — get dataset details + schema
- `DELETE /api/datasets/:id` — delete dataset + file
- `POST /api/datasets/:id/query` — run SQL query against DuckDB, return results
- `GET /api/datasets/:id/preview` — first 100 rows

**Frontend (Datasets page under More menu):**
- Dataset list with cards (name, description, row count, size)
- Upload button (drag & drop CSV/JSON/Excel)
- Dataset explorer:
  - Schema view (columns, types)
  - Data table (sortable, paginated)
  - SQL query editor (Monaco, run button)
  - Query results table
  - Basic chart builder (bar, line, pie from query results)
- AI tool: `query-dataset` — params: datasetId, sql

Use `duckdb` npm package (duckdb-async for Node.js).

### 6. System Page

**Frontend (System page under More menu):**
- Stats cards:
  - CPU usage (percentage + core count)
  - RAM usage (used / total, percentage bar)
  - Storage (used / total, percentage bar)
  - Uptime
  - Architecture (OS, arch)
  - Node.js version
  - Process count
- Network section:
  - Server IP
  - Speed test button (measures download/upload to a known endpoint)
- Actions:
  - "Reboot Server" button (with confirmation dialog)
  - "Clear Cache" button (flushes Redis)
- Logs viewer (last 100 lines of app logs, auto-scroll)

**Backend:**
- `GET /api/system/stats` — returns CPU, RAM, storage, uptime, etc. (use `os` module)
- `POST /api/system/reboot` — triggers graceful restart
- `POST /api/system/clear-cache` — flushes Redis
- `GET /api/system/logs` — returns recent log lines

### 7. Global Search

- Command palette (Cmd+K) already exists — enhance it:
  - Search conversations (by title, message content)
  - Search files (by name, content)
  - Search automations (by name)
  - Search skills (by name)
  - Search settings sections
- Results grouped by type with icons
- Keyboard navigation (arrow keys + enter)
- Recent searches stored locally

### 8. UX Polish

- **Loading states**: skeleton loaders for all async content (not spinners)
- **Error boundaries**: catch React errors, show friendly "Something went wrong" with retry
- **Empty states**: every list view gets a meaningful empty state with action CTA:
  - No conversations → "Start your first chat" button
  - No files → "Upload your first file" button
  - No automations → "Create your first automation" button
  - etc.
- **Toast notifications**: use sonner (already common with shadcn) for:
  - Success messages (file uploaded, automation created)
  - Error messages (failed operations)
  - Automation completion notifications
- **Notification center**: bell icon in header, dropdown showing recent notifications
- **Keyboard shortcuts**:
  - Cmd+K: command palette (existing)
  - Cmd+N: new conversation
  - Cmd+Enter: send message
  - Cmd+S: save (in editors)
  - Cmd+/: toggle sidebar
- **Configurable keybindings**: Settings → UX → Keyboard Shortcuts (list with rebind)

### 9. Documentation

Create in project root:

**README.md:**
- Project name + tagline + logo placeholder
- Feature list with emoji bullets
- Screenshots placeholder section
- Quick start (docker compose up)
- Tech stack
- Architecture overview (brief)
- Link to SETUP.md for detailed instructions
- Contributing link
- License (MIT)

**SETUP.md:**
- Prerequisites (Docker, domain optional)
- Quick start (3 steps)
- Environment variables reference (ALL env vars documented)
- Provider setup guides (LiteLLM, Gmail OAuth, Telegram bot, etc.)
- Custom domain setup (Caddy config)
- Backup & restore
- Troubleshooting FAQ

**CONTRIBUTING.md:**
- Development setup (pnpm install, dev mode)
- Project structure
- Code style
- PR process
- Skill contribution guide

## Implementation Order

1. Database: user profiles, onboarding flag, datasets table, theme preference
2. Onboarding wizard (all 6 steps + post-onboarding chat)
3. Dashboard home page
4. Theme system (CSS variables + 20 themes + switcher UI)
5. Mobile responsive pass (all pages)
6. Datasets backend (DuckDB, CRUD, query)
7. Datasets frontend (explorer, query editor, charts)
8. System page (stats, logs, actions)
9. Global search enhancement (command palette)
10. Loading states, error boundaries, empty states across all pages
11. Toast notifications + notification center
12. Keyboard shortcuts + configurable keybindings
13. README.md, SETUP.md, CONTRIBUTING.md

## Acceptance Criteria
- [ ] New user: signup → onboarding wizard → first chat in <3 minutes
- [ ] Dashboard shows recent conversations, automations, quick actions
- [ ] 20+ themes work correctly (colors apply everywhere)
- [ ] All pages responsive on mobile (320px minimum)
- [ ] Datasets: upload CSV → explore data → run SQL queries → see chart
- [ ] System page shows real stats (CPU, RAM, storage)
- [ ] Global search finds conversations, files, automations, skills
- [ ] No broken empty states anywhere
- [ ] Skeleton loaders on all async content
- [ ] Toast notifications for all operations
- [ ] Keyboard shortcuts work
- [ ] README, SETUP, CONTRIBUTING docs complete
- [ ] Both `packages/web` and `packages/core` build clean

## What NOT to Build Yet
- AI browser use (Phase 10)
- MCP server (Phase 10)
- Image/video generation (Phase 10)
- Commerce / multi-user (Phase 11)
- Desktop app (Phase 12)
