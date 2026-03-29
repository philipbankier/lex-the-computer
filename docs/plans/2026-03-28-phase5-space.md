# Codex Task: Lex the Computer — Phase 5: Space (Personal Domain)

## Overview
Build the **Space** feature — a personal web presence system where users create pages (React components) and API endpoints, all served from a subdomain. Think of it as a mini website builder integrated into the AI computer.

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — full system architecture, tech stack, data model
- `PLAN.md` — Phase 5 section for complete feature list
- `UI-AUDIT.md` — how Zo Computer implements Space

## What Already Exists (Phases 0–4 complete)
- Full monorepo: `packages/web` (Next.js 15), `packages/core` (Hono), `packages/shared`
- PostgreSQL + Drizzle ORM with existing schema
- Auth (Better Auth), Redis, BullMQ
- Tab-based UI with sidebar nav (Space is already a nav item shell)
- Chat system with AI tools, streaming, personas, rules, BYOK
- File browser with Monaco editor
- Automations with cron scheduling
- Sites & Services (Phase 4) — site hosting with Hono+Bun, service management, secrets

## Phase 5 Requirements

### Database Schema
Add to Drizzle schema:

```typescript
// Space routes (pages + API endpoints)
space_routes: {
  id: uuid primaryKey
  userId: uuid references users
  path: text not null          // e.g. "/", "/about", "/api/hello"
  type: enum('page', 'api')
  code: text not null           // React component source (pages) or handler source (APIs)
  isPublic: boolean default false  // pages private by default, APIs always public
  createdAt: timestamp
  updatedAt: timestamp
}

// Space route versions (for undo/redo)
space_route_versions: {
  id: uuid primaryKey
  routeId: uuid references space_routes
  code: text not null
  version: integer not null
  createdAt: timestamp
}

// Space assets (uploaded images/files)
space_assets: {
  id: uuid primaryKey
  userId: uuid references users
  filename: text not null
  path: text not null           // storage path
  mimeType: text
  size: integer
  createdAt: timestamp
}

// Space settings
space_settings: {
  id: uuid primaryKey
  userId: uuid references users
  handle: text unique           // subdomain handle
  title: text
  description: text
  favicon: text                 // path to favicon asset
  customCss: text
  updatedAt: timestamp
}

// Space errors (runtime errors from routes)
space_errors: {
  id: uuid primaryKey
  routeId: uuid references space_routes
  error: text not null
  stack: text
  createdAt: timestamp
}
```

### Backend (packages/core)

#### Space Routes API (`/api/space/routes`)
- `GET /api/space/routes` — list all routes for user
- `POST /api/space/routes` — create route (path, type, code, isPublic)
- `GET /api/space/routes/:id` — get route with current code
- `PUT /api/space/routes/:id` — update route code (auto-creates version)
- `DELETE /api/space/routes/:id` — delete route
- `GET /api/space/routes/:id/history` — list all versions
- `POST /api/space/routes/:id/undo` — revert to previous version
- `POST /api/space/routes/:id/redo` — restore next version

#### Space Assets API (`/api/space/assets`)
- `GET /api/space/assets` — list assets
- `POST /api/space/assets` — upload asset (multipart)
- `DELETE /api/space/assets/:id` — delete asset
- `GET /public/space/assets/:filename` — serve asset publicly

#### Space Settings API (`/api/space/settings`)
- `GET /api/space/settings` — get settings
- `PUT /api/space/settings` — update settings (handle, title, etc.)

#### Space Errors API (`/api/space/errors`)
- `GET /api/space/errors` — list recent errors
- `DELETE /api/space/errors` — clear errors

#### Public Space Serving
- Route: `GET /space/:handle/*` (or subdomain-based if configured)
- For page routes: server-render the React component
- For API routes: execute the handler and return response
- Log errors to space_errors table
- Respect isPublic flag (404 for private pages to non-owner)

### Frontend (packages/web)

#### Space Page (`/space` tab)
Main layout: left sidebar (route list) + right content area (code editor)

**Route List Sidebar:**
- Tree view of routes grouped by type (Pages / APIs)
- Each route shows: path, type icon, public/private badge
- "+ New Page" and "+ New API" buttons at top
- Click route → opens in editor

**Code Editor (main area):**
- Monaco editor with full syntax highlighting
- For pages: React/JSX mode with Tailwind CSS autocomplete hints
- For APIs: TypeScript mode
- Save button (Cmd+S shortcut)
- Public/Private toggle switch
- "Preview" button → opens preview panel or new tab

**Route Creation Dialog:**
- Path input (with "/" prefix hint)
- Type selector (Page / API)
- Starter templates:
  - Page: basic React component with Tailwind
  - API: basic Hono handler returning JSON

**Version History Panel (toggleable):**
- Timeline of versions with timestamps
- Click version → preview diff
- Undo/Redo buttons in editor toolbar

**Errors Panel (toggleable):**
- List of recent errors with route, message, timestamp
- Click error → navigates to route
- Clear all button

**Settings Tab:**
- Handle input (subdomain)
- Title, description
- Favicon upload
- Custom CSS editor
- Preview URL display

**Asset Manager (tab or panel):**
- Grid of uploaded assets with thumbnails
- Upload button (drag & drop zone)
- Copy public URL button per asset
- Delete button per asset

### AI Tools
Register these tools in the AI tool system (same pattern as existing tools):

- `create-space-route` — params: path, type, code, isPublic
- `edit-space-route` — params: routeId or path, newCode
- `delete-space-route` — params: routeId or path
- `list-space-routes` — no params, returns all routes
- `get-space-route` — params: routeId or path, returns code
- `get-space-route-history` — params: routeId or path
- `undo-space-route` — params: routeId or path
- `redo-space-route` — params: routeId or path
- `upload-space-asset` — params: filename, content (base64)
- `delete-space-asset` — params: assetId or filename
- `list-space-assets` — no params
- `get-space-errors` — no params, returns recent errors
- `get-space-settings` — no params
- `update-space-settings` — params: handle, title, description, etc.
- `restart-space-server` — restarts the space serving process

## Implementation Order

1. Database: add space tables to Drizzle schema, generate migration
2. Backend: Space routes CRUD API
3. Backend: Space versions API (undo/redo)
4. Backend: Space assets API (upload/serve)
5. Backend: Space settings API
6. Backend: Space errors API
7. Backend: Public space serving (render pages, execute APIs)
8. Frontend: Space page layout (route list sidebar + editor)
9. Frontend: Route CRUD (create dialog, edit, delete)
10. Frontend: Monaco editor integration for space code
11. Frontend: Preview functionality
12. Frontend: Version history panel with undo/redo
13. Frontend: Asset manager
14. Frontend: Settings tab
15. Frontend: Errors panel
16. AI tools: register all space tools
17. Wire routes in `packages/core/src/index.ts`

## Acceptance Criteria
- [ ] Can create page routes with React component code
- [ ] Can create API endpoint routes
- [ ] Pages render at public URL (`/space/:handle/path`)
- [ ] API endpoints respond at public URL
- [ ] Public/private toggle works (private = 404 to non-owner)
- [ ] Undo/redo works across versions
- [ ] Version history shows all past edits
- [ ] Assets can be uploaded and served publicly
- [ ] Space settings (handle, title) work
- [ ] Errors are captured and viewable
- [ ] All AI tools work from chat
- [ ] Both `packages/web` and `packages/core` build clean

## What NOT to Build Yet
- Custom domains with auto TLS (future)
- Subdomain DNS setup (just use path-based `/space/:handle/` for now)
- Skills (Phase 6)
- Integrations (Phase 7)
- Channels (Phase 8)
