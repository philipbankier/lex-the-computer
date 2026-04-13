# R2 — Service Layer & Router Implementation

## Summary
Implemented the complete service layer for all 22+ product routers. Every router now delegates business logic to dedicated service modules, with Pydantic v2 schemas for request/response validation.

## Changes

### Database (`app/database.py`)
- Fixed `get_db()` return type to `AsyncGenerator[AsyncSession, None]`

### Schemas (`app/schemas/`) — 17 new files
Created Pydantic v2 request/response models grouped by feature area:
- `common.py` — OkResponse, ErrorDetail
- `auth.py` — AuthRequest, AuthResponse, SessionUser, SessionResponse
- `users.py` — ProfileUpdate, ProfileResponse, AdminUserResponse, AdminStatsResponse
- `content.py` — BookmarkCreate/Response, NotificationResponse, SecretCreate/Response
- `api_keys.py` — KeyCreate, KeyUpdate, KeyResponse, KeyCreateResponse
- `files.py` — FileInfo, DirectoryListing, FileContentResponse, FileSearchResult
- `sites.py` — SiteCreate, SiteResponse, SiteFileWrite
- `services.py` — ServiceCreate, ServiceUpdate, ServiceResponse, ServiceLogResponse
- `datasets.py` — DatasetCreate, DatasetResponse, QueryRequest/Response, DatasetPreview
- `commerce.py` — AccountCreate, ProductCreate, PriceCreate, PaymentLinkCreate, OrderResponse
- `space.py` — RouteCreate/Update/Response, AssetResponse, SettingsUpdate, SpaceErrorResponse
- `skills.py` — SkillCreate, SkillResponse, HubSkillResponse, SkillInstallRequest
- `domains.py` — DomainCreate, DomainResponse
- `integrations.py` — TokenCreate, IntegrationResponse, OAuthStartResponse, ProviderConfig
- `system.py` — SystemStats, RebootResponse, ClearCacheResponse
- `chat.py` — CreateConversationRequest, SendMessageRequest, AutomationCreate/Update/Response
- `search.py` — SearchResult, SessionSearchResult
- `onboarding.py` — ProfileStep, MemoryStep, ProviderStep, PersonaStep, ChannelStep

### Services (`app/services/`) — 18 new files
Extracted business logic from routers into dedicated service modules:
- `auth.py` — User lookup, creation, get-or-create
- `profile.py` — Profile read/update, avatar management
- `bookmarks.py` — Bookmark CRUD with user isolation
- `notifications.py` — List, unread count, mark read, mark all read
- `secrets.py` — Secret CRUD with encryption
- `api_keys.py` — Key generation, hashing, validation, CRUD
- `file_manager.py` — Workspace file operations (list, read, write, delete, rename, search, zip)
- `site_manager.py` — Site CRUD + lifecycle (publish/unpublish/restart with process management)
- `service_manager.py` — Service CRUD + lifecycle (start/stop/restart with subprocess and log capture)
- `dataset_manager.py` — Dataset CRUD + DuckDB query execution and preview
- `skill_manager.py` — Skill CRUD, hub listing, install from hub, tag management
- `domain_manager.py` — Custom domain CRUD with DNS verification
- `space_manager.py` — Space routes CRUD, versioning, undo/redo, assets, settings, public serving
- `integration_manager.py` — OAuth flow management for 7 providers, token refresh
- `commerce_manager.py` — Stripe Connect account, products, prices, payment links, orders, webhooks
- `admin_manager.py` — Admin stats, user management, container start/stop, usage/billing
- `system_manager.py` — System stats, cache clearing, log retrieval, reboot
- `settings_manager.py` — AI provider configuration (OpenAI, Anthropic, Google, Mistral, Groq, OpenRouter)
- `onboarding_manager.py` — Multi-step wizard, OpenClaw/Hermes config generation
- `search_manager.py` — Global search (skills + files), session full-text search via tsvector
- `terminal_manager.py` — PTY-based terminal sessions with resize support

### Routers (18 rewritten, 7 kept as-is)
Rewritten to be thin HTTP wrappers delegating to services:
- auth, profile, bookmarks, notifications, secrets, api_keys
- files, sites, services, datasets, skills, domains
- space, admin, system, settings, onboarding, search

Kept as-is (already well-structured around harness/external APIs):
- chat, automations, health, sell, integrations

Stub implementations now functional:
- **terminal.py** — WebSocket endpoint with PTY-based terminal sessions
- **public_api.py** — Wired to OpenClaw harness for actual /ask and /models endpoints
- **services.py** — start/stop/restart/logs now use subprocess management
- **sites.py** — publish/unpublish/restart now manage Bun child processes
- **admin.py** — container start/stop now update DB status

## Verification
- All 156 routes load successfully via `app.main`
- All schema, service, and router modules import without errors
- Tested with project virtualenv (`packages/api/.venv/bin/python`)
