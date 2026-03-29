# Codex Task: Lex the Computer — Phase 6: Skills (Agent Capabilities) ⭐

## Overview
Build the **Skills** system — a top-level feature for managing AI agent capabilities with an AgentSkills-format marketplace. Users can install community skills from a Hub, create custom skills, and the AI automatically loads relevant skills when tasks match their descriptions.

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — full system architecture, tech stack, data model
- `PLAN.md` — Phase 6 section for complete feature list
- `UI-AUDIT.md` — how Zo Computer implements Skills

## What Already Exists (Phases 0–5 complete)
- Full monorepo: `packages/web` (Next.js 15), `packages/core` (Hono), `packages/shared`
- PostgreSQL + Drizzle ORM with existing schema
- Auth, Redis, BullMQ, tab-based UI with sidebar nav
- Chat with AI tools, streaming, personas, rules, BYOK
- File browser with Monaco editor
- Automations with cron scheduling
- Sites & Services (hosting, service management, secrets)
- Space (personal domain, route editor, assets, undo/redo)

**Skills is already a nav item in the sidebar shell — replace the empty page.**

## Phase 6 Requirements

### AgentSkills Format
Each skill follows this structure:
```
Skills/<skill-name>/
├── SKILL.md          # Frontmatter (name, description, compatibility, metadata, allowed-tools) + instructions
├── scripts/           # Optional: executable scripts
├── references/        # Optional: reference docs the AI can load
└── assets/            # Optional: images, data files
```

**SKILL.md frontmatter example:**
```yaml
---
name: web-researcher
description: Search the web and summarize findings for research tasks
compatibility:
  - openclaw
  - lex
metadata:
  author: lex-community
  version: 1.0.0
  tags: [research, web, search]
  icon: 🔍
allowed-tools:
  - web_search
  - web_fetch
  - read
  - write
---

# Web Researcher

Instructions for the AI on how to use this skill...
```

### Database Schema
Add to Drizzle schema:

```typescript
// Installed skills (local registry)
skills: {
  id: uuid primaryKey
  userId: uuid references users
  name: text not null
  description: text
  author: text
  version: text
  icon: text                    // emoji or icon URL
  path: text not null           // filesystem path to skill directory
  source: enum('local', 'hub')  // where it came from
  hubId: text                   // reference to hub registry entry (if installed from hub)
  isActive: boolean default true
  installedAt: timestamp
  updatedAt: timestamp
}

// Skills hub registry (cached from remote or seeded)
skills_hub: {
  id: uuid primaryKey
  name: text not null
  description: text
  author: text
  version: text
  icon: text
  tags: text[]                  // searchable tags
  repoUrl: text                 // GitHub repo URL
  downloadUrl: text             // direct download URL (tarball/zip)
  downloads: integer default 0
  rating: numeric
  readme: text                  // cached README content
  skillMd: text                 // cached SKILL.md content
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Backend (packages/core)

#### Skills API (`/api/skills`)
- `GET /api/skills` — list installed skills for user
- `GET /api/skills/:id` — get skill details (including SKILL.md content)
- `POST /api/skills` — create a new skill (name, description → scaffolds directory)
- `DELETE /api/skills/:id` — uninstall skill (removes from Skills/ directory + DB)
- `PUT /api/skills/:id/toggle` — toggle active/inactive
- `GET /api/skills/:id/files` — list files in skill directory

#### Skills Hub API (`/api/skills/hub`)
- `GET /api/skills/hub` — list hub skills (with pagination, search, tag filter)
- `GET /api/skills/hub/:id` — get hub skill details (full readme, SKILL.md preview)
- `POST /api/skills/hub/:id/install` — install from hub:
  1. Download skill package from repoUrl/downloadUrl
  2. Extract to `workspace/skills/<skill-name>/`
  3. Parse SKILL.md frontmatter
  4. Create `skills` DB record with source='hub'
  5. Return installed skill
- `GET /api/skills/hub/search?q=...&tags=...` — search hub

#### Skill Loading for AI (Progressive)
Implement in the AI/chat system:
1. **Always in context**: List of all active skills with name + description (from frontmatter)
2. **On task match**: When a user message matches a skill's description, load the full SKILL.md content into the AI context
3. **On demand**: When SKILL.md references files in `references/` or `scripts/`, load them when the AI requests

Add a middleware/hook in the chat system that:
- Scans installed active skills
- Matches user message against skill descriptions (simple keyword/semantic matching)
- Injects matched skill's SKILL.md into the system prompt

#### Seed Hub Data
Create a seed script that populates `skills_hub` with 5 built-in starter skills:
1. **Brainstorming Expert** — structured brainstorming and ideation
2. **Skill Creator** — helps create new skills (meta!)
3. **GitHub** — GitHub operations via gh CLI
4. **Web Researcher** — web search and summarization
5. **Code Reviewer** — code review and feedback

For each, create actual SKILL.md files with real, useful instructions. These should be genuinely helpful skills, not stubs.

### Frontend (packages/web)

#### Skills Page (`/skills` tab)
Two-tab layout:

**Tab 1: Installed**
- Grid of skill cards
- Each card shows:
  - Icon (emoji or image)
  - Name (bold)
  - Author tag (subtle)
  - Description (2-line truncated)
  - Active/Inactive toggle
  - Uninstall button (with confirmation)
- "Create Skill" button (top right):
  - Opens dialog: name + description input
  - Creates skill directory with SKILL.md template
  - Opens file browser to the new skill's directory
- "Open Folder" button → navigates to Skills directory in file browser
- Empty state: "No skills installed. Browse the Hub to get started."

**Tab 2: Hub**
- Search bar at top (searches name, description, tags)
- Tag filter chips (clickable tags)
- Grid of skill cards from hub:
  - Icon, name, author, description
  - Download count, version
  - "Install" button (or "Installed ✓" if already installed)
  - Click card → expands to show full README/details
- Loading states and error handling
- "Submit a Skill" link → opens GitHub repo URL

**Skill Detail View (expanded card or modal):**
- Full name, author, version, icon
- Full description / README content
- SKILL.md preview (what the AI will see)
- Tags
- Install/Uninstall button
- Link to source repo

#### Skill Card Component
Reusable component used in both Installed and Hub tabs:
```tsx
<SkillCard
  name="Web Researcher"
  author="lex-community"
  description="Search the web and summarize findings..."
  icon="🔍"
  version="1.0.0"
  isInstalled={true}
  isActive={true}
  onInstall={() => {}}
  onUninstall={() => {}}
  onToggle={() => {}}
/>
```

### AI Tools
Register these tools in the AI tool system:

- `create-skill` — params: name, description → scaffolds Skills/<name>/SKILL.md with template
- `list-skills` — returns all installed skills with status
- `get-skill` — params: name or id → returns full SKILL.md content
- `toggle-skill` — params: name or id, active (boolean)
- `install-hub-skill` — params: hubSkillId or name → installs from hub
- `uninstall-skill` — params: name or id
- `search-hub-skills` — params: query, tags → searches hub

## Implementation Order

1. Database: add skills + skills_hub tables to Drizzle schema, generate migration
2. Backend: Skills CRUD API (installed skills)
3. Backend: Skills Hub API (list, search, detail, install)
4. Backend: Seed script for 5 built-in hub skills (with real SKILL.md content)
5. Backend: Progressive skill loading in AI/chat system
6. Frontend: Skills page layout with Installed/Hub tabs
7. Frontend: SkillCard component
8. Frontend: Installed tab (grid, create dialog, toggle, uninstall)
9. Frontend: Hub tab (search, tag filter, install flow, detail view)
10. AI tools: register all skill tools
11. Wire routes in `packages/core/src/index.ts`

## Acceptance Criteria
- [ ] Skills page shows two tabs: Installed and Hub
- [ ] Hub shows 5 seeded starter skills with real content
- [ ] Can install a skill from Hub → appears in Installed tab
- [ ] Can uninstall a skill → removed from Installed + filesystem
- [ ] Can create a new skill → scaffolds directory with SKILL.md template
- [ ] Active/inactive toggle works
- [ ] Hub search works (by name, description, tags)
- [ ] AI automatically loads relevant skill SKILL.md when task matches description
- [ ] All AI tools work from chat
- [ ] Both `packages/web` and `packages/core` build clean

## What NOT to Build Yet
- Remote hub registry (use local seeded data for now)
- Skill ratings/reviews system
- Skill auto-updates
- Integrations (Phase 7)
- Channels (Phase 8)
