# Phase 4: Sites & Services

## Overview
Build the website hosting system and service manager. Users can create sites (AI scaffolds a project), edit code, preview live, and publish to a public URL. Services let users run arbitrary HTTP/TCP processes with public endpoints. This phase also adds a secrets/env manager.

## Existing Code
- DB table: `sites` (id, user_id, name, slug, framework, is_published, custom_domain, port, created_at)
- DB table: `secrets` (id, user_id, key, value_encrypted, created_at) — already used for BYOK
- Shell pages: `hosting/page.tsx` (empty), settings page has Advanced tab with secrets placeholder
- Workspace: `workspace/sites/` directory auto-created on startup
- File tools already exist (create_file, edit_file, etc.)
- No `services` table exists yet — need to add to schema

## Phase 4a: Database — Services Table

1. Add `services` table to `packages/core/src/db/schema.ts`:
   ```
   services: id, user_id, name, type ('http'|'tcp'), port, entrypoint, working_dir, env_vars (jsonb), is_running, public_url, created_at
   ```
2. Add a migration file `packages/core/migrations/0003_services.sql` with the CREATE TABLE

## Phase 4b: Backend — Sites API

3. Create `packages/core/src/routes/sites.ts`:
   - `POST /api/sites` — Create site. Body: `{ name, slug }`. Scaffolds a Hono + Bun project in `workspace/sites/{slug}/`:
     - `index.ts` — basic Hono server
     - `package.json` — with hono, dependencies
     - `lexsite.json` — site config `{ name, slug, framework: 'hono' }`
   - `GET /api/sites` — List sites for user
   - `GET /api/sites/:id` — Get site details
   - `PATCH /api/sites/:id` — Update site (name, slug, is_published, custom_domain)
   - `DELETE /api/sites/:id` — Delete site (stops process, removes files)
   - `POST /api/sites/:id/publish` — Set is_published=true, assign port if not set
   - `POST /api/sites/:id/unpublish` — Set is_published=false
   - `GET /api/sites/:id/files` — List files in the site directory (reuse files route logic)
   - `GET /api/sites/:id/files/content` — Read a file in the site directory
   - `POST /api/sites/:id/files/content` — Write a file in the site directory

4. Create `packages/core/src/services/site-runner.ts`:
   - `startSite(siteId)` — Spawns the site process (using `child_process.spawn` with the entrypoint from lexsite.json or `bun run index.ts`). Assigns a port. Tracks the child process.
   - `stopSite(siteId)` — Kills the child process
   - `restartSite(siteId)` — stop + start
   - `getSiteStatus(siteId)` — Returns running/stopped + port
   - Port allocation: start from 4100, increment per site. Track in-memory map.
   - Store PID and port in sites table

## Phase 4c: Backend — Services API

5. Create `packages/core/src/routes/services.ts`:
   - `POST /api/services` — Register a service. Body: `{ name, type, port, entrypoint, working_dir, env_vars }`
   - `GET /api/services` — List services
   - `GET /api/services/:id` — Get service details
   - `PATCH /api/services/:id` — Update service config
   - `DELETE /api/services/:id` — Delete service (stop process first)
   - `POST /api/services/:id/start` — Start the service process
   - `POST /api/services/:id/stop` — Stop the service process
   - `POST /api/services/:id/restart` — Restart
   - `GET /api/services/:id/logs` — Get recent stdout/stderr (keep last 1000 lines in memory)

6. Create `packages/core/src/services/service-runner.ts`:
   - Similar to site-runner but for arbitrary services
   - Spawns `child_process.spawn` with entrypoint command in working_dir
   - Captures stdout/stderr in a ring buffer
   - Tracks running processes in-memory map

## Phase 4d: Backend — AI Site & Service Tools

7. Create tools in `packages/core/src/tools/`:
   - `create_site` — Creates a new site with scaffolded files
   - `publish_site` — Publishes a site
   - `unpublish_site` — Unpublishes a site
   - `register_service` — Registers a new service
   - `update_service` — Updates service config
   - `delete_service` — Deletes a service
   - `list_services` — Lists all services
8. Register all new tools in chat route's toolsList

## Phase 4e: Backend — Secrets/Env API

9. Expand secrets management (already partially in settings.ts):
   - `GET /api/secrets` — List all secrets for user (keys only, not values)
   - `POST /api/secrets` — Create/update secret. Body: `{ key, value, description? }`
   - `DELETE /api/secrets/:key` — Delete secret
   - Secrets are available to sites and services as environment variables at runtime

## Phase 4f: Frontend — Sites UI

Update `packages/web/app/(app)/hosting/page.tsx`:

10. **Sites list view**:
    - Cards for each site: name, slug, status (running/stopped), published indicator, URL
    - "New Site" button → opens create form
    - Click site → opens site detail/editor view

11. **Create site form** (modal):
    - Name input, slug input (auto-generated from name)
    - Create button → calls API → navigates to site editor

12. **Site editor view** (within the hosting page or as a sub-view):
    - Left panel: file tree for the site directory
    - Right panel: code editor (textarea with syntax highlighting if possible, or plain textarea)
    - Below: live preview iframe showing the running site at `http://localhost:{port}`
    - Toolbar: Save, Publish/Unpublish, Restart, Delete
    - If published, show the public URL

13. **Site controls**:
    - Start/Stop/Restart buttons
    - Publish/Unpublish toggle
    - Delete with confirmation

## Phase 4g: Frontend — Services UI

14. **Services sub-tab** in the hosting page (tabs: Sites | Services):
    - Service cards: name, type, port, status (running/stopped)
    - "New Service" button → opens form
    - Create form: name, type (http/tcp), port, entrypoint command, working directory, env vars (key-value pairs)
    - Start/Stop/Restart buttons on each card
    - View Logs button → shows last 50 lines of stdout/stderr

## Phase 4h: Frontend — Secrets UI

15. Update Settings → Advanced tab:
    - Secrets section: list of key-value pairs
    - Add new secret: key input + value input (masked) + optional description
    - Delete button per secret
    - "Paste .env" button → parses KEY=VALUE lines and creates secrets
    - Help text: "Environment variables available to your sites and services"

## Wire Routes

16. Wire all new routers in `packages/core/src/index.ts`:
    - `app.route('/api/sites', sitesRouter)` — replace placeholder
    - `app.route('/api/services', servicesRouter)` — new
    - `app.route('/api/secrets', secretsRouter)` — new (or expand existing settings)

## Acceptance Criteria
- [ ] Can create a site via UI → scaffolds files in workspace/sites/
- [ ] Site file tree visible, can edit code in site files
- [ ] Site can be started (process spawns) and preview works in iframe
- [ ] Publish/unpublish toggle works
- [ ] Can create services with custom entrypoints
- [ ] Service start/stop/restart work
- [ ] Service logs viewable
- [ ] AI tools: create_site, publish_site, unpublish_site
- [ ] AI tools: register_service, update_service, delete_service, list_services
- [ ] Secrets CRUD works in settings
- [ ] Both builds pass clean

## What NOT to Build Yet
- Custom domains with auto TLS (future — needs Caddy config)
- SQLite browser for sites (future)
- Space (Phase 5)
- Skills (Phase 6)
