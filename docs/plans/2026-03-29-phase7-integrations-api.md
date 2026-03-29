# Codex Task: Lex the Computer — Phase 7: Integrations & API

## Overview
Build the **Integrations** system (OAuth2 third-party connections) and the **Public REST API** (programmatic access to Lex). Users connect their Gmail, Calendar, Notion, etc. and the AI can use them as tools. External apps can talk to Lex via API keys.

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — full system architecture, tech stack, data model
- `PLAN.md` — Phase 7 section for complete feature list
- `UI-AUDIT.md` — how Zo Computer implements Integrations

## What Already Exists (Phases 0–6 complete)
- Full monorepo: `packages/web` (Next.js 15), `packages/core` (Hono), `packages/shared`
- PostgreSQL + Drizzle ORM, Auth (Better Auth), Redis, BullMQ
- Tab-based UI, Chat with AI tools, Files, Automations, Sites & Services, Space, Skills
- Settings page with existing tabs (AI, Channels, Integrations, UX, Advanced) — Integrations tab is a shell

## Phase 7 Requirements

### Database Schema
Add to Drizzle schema:

```typescript
// OAuth2 integrations (connected accounts)
integrations: {
  id: uuid primaryKey
  userId: uuid references users
  provider: text not null        // 'gmail', 'google-calendar', 'notion', 'google-drive', 'dropbox', 'linear', 'github'
  label: text                    // user-given label, e.g. "Work Gmail", "Personal Drive"
  accessToken: text not null     // encrypted
  refreshToken: text             // encrypted
  tokenExpiresAt: timestamp
  scope: text                    // granted scopes
  permission: enum('read', 'readwrite') default 'readwrite'
  accountEmail: text             // email associated with this connection
  accountName: text              // display name from provider
  accountAvatar: text            // avatar URL from provider
  isActive: boolean default true
  connectedAt: timestamp
  updatedAt: timestamp
}

// API keys (for public REST API)
api_keys: {
  id: uuid primaryKey
  userId: uuid references users
  name: text not null            // user-given name, e.g. "My App", "Zapier"
  keyHash: text not null         // bcrypt hash of the key (never store plain)
  keyPrefix: text not null       // first 8 chars for display, e.g. "lex_a8f3..."
  lastUsedAt: timestamp
  expiresAt: timestamp           // optional expiration
  isActive: boolean default true
  createdAt: timestamp
}
```

### Backend (packages/core)

#### OAuth2 Framework
Build a generic OAuth2 handler that all integrations use:

```typescript
// Generic flow:
// 1. GET /api/integrations/:provider/auth → redirect to provider's OAuth consent
// 2. GET /api/integrations/:provider/callback → exchange code for tokens, save to DB
// 3. Token refresh middleware: auto-refresh expired tokens before API calls
```

Use the `arctic` library for OAuth2 (already popular in the Hono ecosystem). Each provider needs:
- Client ID + Secret (from env vars)
- Scopes
- Token exchange
- Refresh logic

**Provider configs** (env vars pattern: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, etc.):

| Provider | Scopes (Read) | Scopes (ReadWrite) |
|----------|--------------|-------------------|
| Gmail | gmail.readonly | gmail.modify, gmail.send |
| Google Calendar | calendar.readonly | calendar.events |
| Google Drive | drive.readonly | drive.file |
| Notion | (API key based, not OAuth) | same |
| Dropbox | files.metadata.read, files.content.read | files.content.write |
| Linear | read | write |
| GitHub | repo (read), user | repo, user |

**Note on Notion**: Notion uses internal integration tokens (API key), not OAuth2. Build a simple token-based connection for Notion (user pastes their integration token).

#### Integrations API (`/api/integrations`)
- `GET /api/integrations` — list connected integrations for user
- `GET /api/integrations/:id` — get integration details
- `DELETE /api/integrations/:id` — disconnect (revoke + delete tokens)
- `PUT /api/integrations/:id` — update label, permission level
- `GET /api/integrations/:provider/auth` — start OAuth flow
- `GET /api/integrations/:provider/callback` — OAuth callback
- `POST /api/integrations/:id/test` — test connection (make a simple API call)

#### Integration Service Layer
For each provider, build a service module:

**Gmail** (`services/integrations/gmail.ts`):
- `searchEmails(query, maxResults)` → returns email list
- `getEmail(emailId)` → returns full email with body
- `sendEmail(to, subject, body, cc?, bcc?)` → sends email
- `getLabels()` → returns Gmail labels

**Google Calendar** (`services/integrations/calendar.ts`):
- `listEvents(startDate, endDate)` → returns events
- `getEvent(eventId)` → returns event details
- `createEvent(title, start, end, description?, attendees?)` → creates event
- `updateEvent(eventId, updates)` → updates event
- `deleteEvent(eventId)` → deletes event

**Notion** (`services/integrations/notion.ts`):
- `searchPages(query)` → returns pages
- `getPage(pageId)` → returns page content (as markdown)
- `createPage(parentId, title, content)` → creates page
- `updatePage(pageId, content)` → updates page
- `listDatabases()` → returns databases
- `queryDatabase(dbId, filter?)` → returns rows

**Google Drive** (`services/integrations/drive.ts`):
- `searchFiles(query)` → returns file list
- `getFile(fileId)` → returns file metadata
- `downloadFile(fileId)` → downloads file content
- `uploadFile(name, content, mimeType, folderId?)` → uploads file

**Dropbox** (`services/integrations/dropbox.ts`):
- `searchFiles(query)` → returns file list
- `getFile(path)` → returns file metadata
- `downloadFile(path)` → downloads content
- `uploadFile(path, content)` → uploads file

**Linear** (`services/integrations/linear.ts`):
- `searchIssues(query)` → returns issues
- `getIssue(issueId)` → returns issue details
- `createIssue(teamId, title, description, priority?, assigneeId?)` → creates issue
- `updateIssue(issueId, updates)` → updates issue
- `listTeams()` → returns teams

**GitHub** (`services/integrations/github.ts`):
- `listRepos()` → returns repos
- `getRepo(owner, repo)` → returns repo details
- `listIssues(owner, repo, state?)` → returns issues
- `createIssue(owner, repo, title, body)` → creates issue
- `listPRs(owner, repo, state?)` → returns PRs
- `getFileContent(owner, repo, path)` → returns file content

#### AI Tools for Integrations
Register one tool per integration (follows existing tool pattern):

- `use-gmail` — params: action (search/read/send/labels), plus action-specific params
- `use-calendar` — params: action (list/get/create/update/delete), plus action-specific params
- `use-notion` — params: action (search/get/create/update/list-dbs/query-db), plus params
- `use-drive` — params: action (search/get/download/upload), plus params
- `use-dropbox` — params: action (search/get/download/upload), plus params
- `use-linear` — params: action (search/get/create/update/list-teams), plus params
- `use-github` — params: action (list-repos/get-repo/list-issues/create-issue/list-prs/get-file), plus params
- `list-app-tools` — no params, returns which integrations are connected and available

Each tool should:
1. Check if the integration is connected and active
2. Auto-refresh token if expired
3. Check permission level (read vs readwrite)
4. Execute the requested action
5. Return formatted results

#### Public REST API (`/api/v1`)

**Authentication**: Bearer token (API key) in Authorization header.

Middleware: validate API key → find user → attach to request context.

**Endpoints:**

`POST /api/v1/ask`
```json
{
  "message": "What's on my calendar today?",
  "conversation_id": "optional-uuid",  // for multi-turn
  "model_name": "optional-model",
  "persona_id": "optional-uuid",
  "output_format": "text" | "json",    // json = structured output
  "stream": false                       // true = SSE streaming
}
```
Response:
```json
{
  "response": "You have 3 events today...",
  "conversation_id": "uuid",
  "model": "gpt-4o",
  "usage": { "prompt_tokens": 150, "completion_tokens": 80 }
}
```

`GET /api/v1/models/available` — returns list of available models
`GET /api/v1/personas/available` — returns list of personas
`GET /api/v1/conversations/:id` — returns conversation history

#### API Keys API (`/api/api-keys`)
- `GET /api/api-keys` — list keys (show prefix + name + last used, never full key)
- `POST /api/api-keys` — create key (returns full key ONCE in response)
- `DELETE /api/api-keys/:id` — revoke key
- `PUT /api/api-keys/:id` — update name, toggle active

### Frontend (packages/web)

#### Integrations Settings Tab
Replace the Integrations shell in Settings with:

**Connected Integrations List:**
- Card per connected integration showing:
  - Provider icon + name
  - Account email/name
  - Permission level badge (Read Only / Read & Write)
  - Label (editable)
  - "Test" button → tests connection
  - "Disconnect" button (with confirmation)
- "+ Connect" dropdown showing available providers:
  - Each provider shows icon + name
  - Click → starts OAuth flow (redirect)
  - Disabled/grayed if env vars not configured (show "Configure in .env" hint)

**Provider Cards (available to connect):**
- Gmail, Google Calendar, Google Drive — Google icon family
- Notion — Notion icon
- Dropbox — Dropbox icon
- Linear — Linear icon
- GitHub — GitHub icon
- Each shows brief description of what it enables

#### API Keys Page (in Settings → Advanced or new "API" tab)
- List of API keys: name, key prefix (`lex_a8f3...`), created date, last used, status
- "Create API Key" button → dialog: name input → shows full key (copy button, "you won't see this again" warning)
- Revoke button per key (with confirmation)
- Active/inactive toggle

### Implementation Order

1. Database: add integrations + api_keys tables, generate migration
2. Backend: OAuth2 framework (generic auth/callback handlers, token refresh)
3. Backend: Gmail integration service + routes
4. Backend: Google Calendar integration service
5. Backend: Notion integration service (token-based)
6. Backend: Google Drive integration service
7. Backend: Dropbox integration service
8. Backend: Linear integration service
9. Backend: GitHub integration service
10. Backend: AI tools for each integration + list-app-tools
11. Backend: Public REST API (/api/v1/ask, models, personas, conversations)
12. Backend: API key management (create, validate, revoke)
13. Frontend: Integrations settings page (connect/disconnect/manage)
14. Frontend: API keys management UI
15. Wire all routes in `packages/core/src/index.ts`

## Acceptance Criteria
- [ ] OAuth2 flow works for Google services (Gmail, Calendar, Drive)
- [ ] Can connect Notion via API token
- [ ] Can connect Dropbox, Linear, GitHub via OAuth
- [ ] Multiple accounts per provider supported
- [ ] Permission levels (read/readwrite) enforced
- [ ] AI tools work for each connected integration
- [ ] `list-app-tools` shows only connected integrations
- [ ] Public API: POST /api/v1/ask works with API key auth
- [ ] Public API: streaming mode works (SSE)
- [ ] API key management: create (show once), list, revoke
- [ ] Both `packages/web` and `packages/core` build clean

## What NOT to Build Yet
- Actual OAuth app registration (use env var placeholders — real credentials come later)
- Airtable integration (deferred to Phase 10 if needed)
- Channels (Phase 8)
- Webhook integrations
