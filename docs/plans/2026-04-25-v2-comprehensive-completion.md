# Lex the Computer V2 — Comprehensive Completion Plan

**Date**: April 25, 2026
**Branch**: `v2` on `/home/philip/TinkerLab/lex-the-computer`
**Goal**: Complete all remaining work to make Lex V2 a fully functional, production-ready application
**Executor**: Codex GPT-5.5 via codex-handoff
**Current state**: 188 tests pass, backend boots, Hermes integration works, chat round-trip verified. Frontend builds but has NOT been browser-tested. Docker Hermes image needs auth fix.

---

## Phase 1: Backend Hardening — Fix All Runtime Issues

### 1.1 Fix Hermes Harness connection for Docker networking
- **File**: `docker-compose.yml`
- **Issue**: `HERMES_API_URL` defaults to `http://hermes:8642` (Docker hostname). When Hermes runs on host, API can't reach it.
- **Fix**: Already patched with `${HERMES_API_URL:-http://hermes:8642}` and `extra_hosts`. Verify this works in both modes (Docker Hermes and host Hermes).

### 1.2 Fix Hermes Docker image GHCR auth
- **File**: `docker/hermes/Dockerfile.hermes`
- **Issue**: `ghcr.io/nousresearch/hermes-agent:latest` returns 403 for anonymous pulls.
- **Fix options**:
  - Option A: Build Hermes from source in Dockerfile (clone repo, pip install)
  - Option B: Use `nousresearch/hermes-agent` Docker Hub image (confirmed exists via `docker search`)
  - Option C: Pin to a specific GHCR tag that's publicly available
- **Test**: `docker build -f docker/hermes/Dockerfile.hermes -t lex-hermes:test .` succeeds

### 1.3 Ensure all 119 API routes return proper responses
- **Files**: `packages/api/app/routers/*.py`
- **Task**: For each router, verify endpoints return correct HTTP status codes and response shapes:
  - `GET` endpoints return 200 with expected schema
  - `POST` endpoints with missing data return 422
  - Auth-protected endpoints return 401 without session
  - Chat endpoint returns SSE stream
- **Test**: Run existing 188 tests + add 10-15 new tests covering edge cases

### 1.4 Database migration completeness
- **Files**: `packages/api/alembic/`
- **Task**: Verify alembic migrations create all expected tables
- **Test**: `alembic upgrade head` on fresh DB, then check all tables exist
- **Tables expected**: users, user_profiles, notifications, sites, services, secrets, datasets, space_routes, space_route_versions, space_assets, space_settings, space_errors, integrations, api_keys, skills, skills_hub, custom_domains, bookmarks, usage, files, commerce tables

### 1.5 Environment variable validation
- **File**: `packages/api/app/config.py`
- **Task**: Add startup validation that critical env vars are set. If `ZAI_API_KEY` is empty and no other provider key exists, log a clear error.
- **Test**: Start API without any API key → see clear error message

### 1.6 Test suite hardening
- **Files**: `packages/api/tests/`
- **Task**: Run `uv run pytest tests/ -v` and ensure ALL 188 pass. Fix any failures.
- **Also**: Add integration test for full chat round-trip with mocked Hermes

---

## Phase 2: Frontend — Browser Testing and Fixes

### 2.1 Page-by-page browser audit
Start the full stack (`docker compose up` + Hermes) and visit each page in a browser. For each page:
- Does it render without JavaScript errors?
- Does it load data from the API correctly?
- Are all interactive elements functional (buttons, forms, inputs)?

**Pages to audit (21 pages):**

1. **`/`** (root) — Landing/redirect
2. **`/login`** — Login form, email + password, error states
3. **`/signup`** — Signup form, validation, creates account
4. **`/onboarding`** — 5-step wizard (account → provider → memory → channels → workspace)
   - Step transitions work
   - Form validation on each step
   - Config writes to Hermes on completion
5. **`/home`** — Dashboard, shows status cards
6. **`/chats`** — Chat interface
   - Message input sends to `/api/chat`
   - SSE stream renders tokens in real-time
   - Conversation list sidebar works
   - New conversation creates correctly
   - Auto-title from first message
7. **`/files`** — File browser
   - Lists files from workspace
   - Upload works
   - Delete/rename work
   - File preview (if implemented)
8. **`/terminal`** — Terminal access
   - WebSocket connection to PTY
   - Command input/output works
9. **`/automations`** — Cron job management
   - List existing automations
   - Create new automation (name, schedule, instruction, delivery)
   - Toggle enable/disable
   - Delete automation
10. **`/skills`** — Skills browser
    - Lists skills from Hermes shared volume
    - View skill content
    - Create/edit/delete skills
11. **`/sites`** — Site management
    - CRUD for hosted sites
    - Site status display
12. **`/services`** — Service management
    - CRUD for hosted services
13. **`/datasets`** — Dataset explorer
    - Upload CSV/JSON
    - Preview data
    - Run DuckDB queries
14. **`/space`** — Space editor
    - Page/API editor
    - Route management
    - Versioning
15. **`/sell`** — Commerce dashboard
    - Stripe Connect setup
    - Product management
    - Order history
16. **`/settings`** — Settings page
    - Shows harness status (Hermes/OpenClaw)
    - Shows memory provider (Honcho/Core)
    - Shows current model
    - API key configuration
    - Profile settings
17. **`/bookmarks`** — Bookmark management
    - List/create/delete bookmarks
18. **`/admin`** — Admin dashboard
    - User management (if multi-user)
    - System stats
19. **`/agents`** — Agent management
20. **`/hosting`** — Hosting overview
21. **`/system`** — System status
22. **`/billing`** — Billing info
23. **`/resources`** — Resources overview

### 2.2 Fix all browser errors found in 2.1
- Fix TypeScript errors that surface at runtime
- Fix API integration issues (wrong endpoints, wrong response shapes)
- Fix SSE streaming issues in chat
- Fix navigation issues
- Fix form validation bugs
- Fix any layout/rendering issues

### 2.3 Chat interface deep testing
- **File**: `packages/web/app/(app)/chats/page.tsx`, `packages/web/components/layout/ChatSidebar.tsx`
- **Critical path**: This is the primary user-facing feature
- **Test**:
  - Send a message → see streaming response appear token by token
  - Send a message with code → verify code blocks render with syntax highlighting
  - Send a message with markdown → verify markdown renders correctly
  - Start a new conversation → verify it appears in sidebar
  - Switch between conversations → verify context switches
  - Delete a conversation → verify it's removed
  - Test with Hermes down → verify graceful error message (not a crash)
  - Test with long messages → verify no buffer overflow or truncation
  - Test with rapid message sending → verify no race conditions

### 2.4 Onboarding wizard deep testing
- **File**: `packages/web/app/onboarding/page.tsx`
- **Test**:
  - Step 1: Create account → verify user created in DB
  - Step 2: Select AI provider → verify config written
  - Step 3: Select memory mode → verify Hermes memory provider set
  - Step 4: Configure channels → verify channel config written
  - Step 5: Set workspace → verify directory created
  - Complete → verify Hermes config files written to data dir
  - Test back navigation between steps
  - Test resuming partial onboarding

### 2.5 Responsive design check
- Test all pages at mobile width (375px)
- Test all pages at tablet width (768px)
- Test all pages at desktop width (1280px)
- Verify no horizontal overflow or broken layouts

---

## Phase 3: Docker & Deployment Polish

### 3.1 Full Docker Compose test
- **Task**: From a clean state (`docker compose down -v`), run `docker compose up --build`
- **Verify**:
  - All services start and become healthy
  - Health check passes on all containers
  - `curl http://localhost:8000/health` returns `{"status": "ok"}`
  - `curl http://localhost:3000` returns the frontend
  - Chat round-trip works through the full Docker stack

### 3.2 Lite mode test
- **Task**: `docker compose -f docker-compose.yml -f docker-compose.lite.yml up --build`
- **Verify**: Same as 3.1 but without Honcho services. Core memory works.

### 3.3 OpenClaw mode test
- **Task**: Verify `docker-compose.openclaw.yml` overrides work correctly
- **Verify**: Config validates, OpenClaw service replaces Hermes

### 3.4 .env.example completeness
- **Task**: Verify every env var in `packages/api/app/config.py` has a corresponding entry in `.env.example` with a comment
- **Verify**: Fresh clone + `cp .env.example .env` + fill in API key → everything works

### 3.5 README smoke test
- **Task**: Follow the README's quick start instructions exactly as written
- **Verify**: A new user could follow the README and get a working instance

---

## Phase 4: Integration Testing — End-to-End Scenarios

### 4.1 Full user journey: new user
1. Visit `http://localhost:3000`
2. Click "Get Started" → land on onboarding
3. Complete onboarding (all 5 steps)
4. Land on dashboard/home
5. Open chat → send a message → receive response
6. Upload a file → see it in file browser
7. Create an automation → see it in automations list
8. Open settings → verify all config shows correctly

### 4.2 Chat persistence test
1. Send 3 messages in a conversation
2. Navigate away to another page
3. Navigate back to chats
4. Verify previous conversation is still there with history

### 4.3 Error resilience test
1. Stop Hermes → verify chat shows "agent unavailable" message (not crash)
2. Stop Postgres → verify API returns 503 (not crash)
3. Send malformed request to chat → verify 400 error (not 500)
4. Restart everything → verify system recovers

### 4.4 File operations test
1. Upload a text file
2. Upload an image file
3. Upload a CSV file
4. List all files → verify all 3 appear
5. Delete one → verify it's gone
6. Try uploading an oversized file → verify graceful error

---

## Phase 5: Code Quality & Documentation Finalization

### 5.1 Lint and type-check
- **Backend**: `cd packages/api && uv run ruff check app/` — fix all warnings
- **Frontend**: `cd packages/web && pnpm lint` — fix all warnings (if lint script exists)
- **Frontend**: `cd packages/web && pnpm build` — zero TypeScript errors

### 5.2 Test coverage
- **Backend**: Run `uv run pytest tests/ -v` — all 188+ tests pass
- **Add tests** for any new fixes from Phases 1-4

### 5.3 Documentation accuracy
- Verify `README.md` instructions match reality
- Verify `docs/SETUP.md` matches actual setup process
- Verify `docs/MIGRATION-v1-to-v2.md` is accurate
- Verify `.env.example` has all variables with correct comments

### 5.4 Git history cleanup
- Ensure no broken commits on v2
- Final commit message should be clean and descriptive
- Push to origin

---

## Acceptance Criteria

The project is complete when:
1. ✅ `docker compose up --build` from clean clone starts everything
2. ✅ All 188+ tests pass
3. ✅ Frontend builds with zero errors/warnings
4. ✅ All 21+ pages render without JavaScript errors in browser
5. ✅ Chat sends a message and receives a streaming response
6. ✅ Onboarding wizard completes end-to-end
7. ✅ File upload/download works
8. ✅ Automations CRUD works
9. ✅ Skills listing works
10. ✅ Settings page shows correct harness/memory/model info
11. ✅ System degrades gracefully when Hermes is down
12. ✅ README quick start works for a fresh user
13. ✅ Lite mode works without Honcho
14. ✅ All code passes lint/type checks
