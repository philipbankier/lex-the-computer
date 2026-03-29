# Codex Task: Lex the Computer — Phase 11: Commerce & Multi-User

## Overview
Build **Stripe Connect commerce** (selling products/services with 0% platform fee), **multi-user mode** (container-per-user isolation), **admin dashboard**, and **production hardening** (health checks, monitoring, backup/restore, deploy scripts).

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — system architecture
- `PLAN.md` — Phase 11 section
- `AUDIT-2026-03-29.md` — ensure all patterns match 2026 standards
- Zo's selling docs pattern: https://docs.zocomputer.com/sell.md (referenced in audit)

## What Already Exists (Phases 0–10 + Remediation complete)
- Full feature set: chat, files, agents, sites, space, skills, integrations, channels, onboarding, advanced features
- AI Providers (Claude Code, Codex, Gemini CLI), fal.ai media, Groq Whisper, MCP server
- Custom domains, Stagehand browser, all missing tools added
- Agents terminology (renamed from automations)

## Phase 11 Requirements

### 1. Stripe Connect Commerce

**Database:**
```typescript
stripe_accounts: {
  id: uuid primaryKey
  userId: uuid references users
  stripeAccountId: text not null     // Stripe Connect account ID (acct_xxx)
  country: text
  onboardingComplete: boolean default false
  chargesEnabled: boolean default false
  payoutsEnabled: boolean default false
  createdAt: timestamp
  updatedAt: timestamp
}

stripe_products: {
  id: uuid primaryKey
  userId: uuid references users
  stripeProductId: text not null
  name: text not null
  description: text
  active: boolean default true
  createdAt: timestamp
}

stripe_prices: {
  id: uuid primaryKey
  productId: uuid references stripe_products
  stripePriceId: text not null
  amount: integer not null           // cents
  currency: text default 'usd'
  type: enum('one_time', 'recurring')
  interval: text                     // 'month', 'year' for recurring
  createdAt: timestamp
}

stripe_payment_links: {
  id: uuid primaryKey
  priceId: uuid references stripe_prices
  stripePaymentLinkId: text not null
  url: text not null
  active: boolean default true
  createdAt: timestamp
}

stripe_orders: {
  id: uuid primaryKey
  userId: uuid references users
  stripeSessionId: text not null
  productName: text
  amount: integer
  currency: text
  customerEmail: text
  paymentStatus: enum('pending', 'paid', 'failed')
  fulfillmentStatus: enum('unfulfilled', 'fulfilled')
  paidAt: timestamp
  fulfilledAt: timestamp
  createdAt: timestamp
}
```

**Backend — Stripe Connect Flow:**
- `POST /api/sell/connect` — create Stripe Connect account, return onboarding URL
- `GET /api/sell/connect/callback` — handle OAuth callback, save account
- `GET /api/sell/account` — get account status (onboarding complete?, charges enabled?)
- `POST /api/sell/account/dashboard` — generate Stripe Dashboard login link

**Backend — Products & Payment Links:**
- `POST /api/sell/products` — create product (name, description)
- `GET /api/sell/products` — list products
- `PUT /api/sell/products/:id` — update product name/description
- `POST /api/sell/products/:id/prices` — create price for product
- `POST /api/sell/prices/:id/payment-link` — create payment link
- `PUT /api/sell/payment-links/:id` — activate/deactivate payment link
- `GET /api/sell/payment-links` — list payment links

**Backend — Orders:**
- `POST /api/sell/webhook` — Stripe webhook handler (checkout.session.completed, etc.)
- `GET /api/sell/orders` — list orders with filters
- `PUT /api/sell/orders/:id/fulfill` — mark order as fulfilled
- `GET /api/sell/orders/export` — export orders as CSV

**0% Platform Fee:** Use Stripe Connect with `application_fee_amount: 0` on all charges.

**AI Tools:**
- `create-stripe-product` — params: name, description
- `create-stripe-price` — params: productId, amount, currency, type?, interval?
- `create-stripe-payment-link` — params: priceId
- `update-stripe-payment-link` — params: paymentLinkId, active (boolean)
- `update-stripe-product` — params: productId, name?, description?
- `list-stripe-payment-links` — no params
- `list-stripe-orders` — params: status?, limit?
- `update-stripe-orders` — params: orderIds[], fulfillmentStatus

**Frontend — Sell Tab (new nav item under More menu):**
Three sub-tabs matching Zo:

**Account tab:**
- Stripe Connect status card
- "Connect Stripe" button → starts OAuth flow
- If connected: onboarding status, "Open Stripe Dashboard" link
- Pending requirements display

**Products tab:**
- "Create" button → dialog: name, description, price, type (one-time/recurring)
- Product list with cards: name, price, payment link URL
- Per product: copy link, activate/deactivate, open in Stripe
- Edit product name/description inline

**Orders tab:**
- Table: product name, amount, customer email, date, payment status, fulfillment status
- "Mark Fulfilled" button per order
- "Export CSV" button
- Filter by: status, date range

### 2. Multi-User Mode

Enabled via `MULTI_USER=true` env var. When disabled (default), single-user mode — all operations run directly on the host.

**Container Architecture:**
- Each user gets an isolated Docker container
- Base image: Debian + Node.js + Bun + Python + common dev tools
- Container has: user's workspace, terminal access, site hosting
- Provisioned on signup, started on use, stopped after idle timeout

**Database additions:**
```typescript
user_containers: {
  id: uuid primaryKey
  userId: uuid references users
  containerId: text              // Docker container ID
  status: enum('creating', 'running', 'stopped', 'error')
  hostname: text                 // internal hostname for routing
  cpuLimit: text default '1'     // CPU cores
  memoryLimit: text default '2g' // RAM
  storageLimit: text default '10g' // disk
  lastActiveAt: timestamp
  createdAt: timestamp
}
```

**Implementation:**
- Use `dockerode` npm package for Docker API
- Container lifecycle:
  - `createContainer(userId)` — pull base image, create container with user workspace mounted
  - `startContainer(userId)` — start stopped container
  - `stopContainer(userId)` — graceful stop after idle timeout (configurable, default 30min)
  - `execInContainer(userId, command)` — run command in user's container
- Tool execution routing:
  - Single-user mode: direct fs operations, direct shell exec
  - Multi-user mode: all file ops and shell commands route through `docker exec`
- Resource limits enforced via Docker `--cpus`, `--memory`, `--storage-opt`
- Workspace isolation: each container mounts `/data/users/{userId}/workspace`

**Container Base Image (`Dockerfile.user`):**
```dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
  curl git build-essential python3 python3-pip \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y nodejs \
  && npm install -g pnpm bun
WORKDIR /workspace
```

### 3. Usage Metering & Rate Limiting

**Database:**
```typescript
usage_records: {
  id: uuid primaryKey
  userId: uuid references users
  type: enum('ai_tokens', 'storage', 'api_calls', 'image_gen', 'video_gen', 'transcription')
  amount: bigint not null
  metadata: jsonb                // model, cost estimate, etc.
  createdAt: timestamp
}
```

**Implementation:**
- Token counting: track prompt + completion tokens per AI request
- Storage tracking: calculate user workspace size periodically
- API call counting: increment on each public API request
- Rate limiting middleware: configurable limits per user per endpoint
- Usage dashboard in user settings

### 4. Admin Dashboard

Only available when `MULTI_USER=true`. Accessible at `/admin` for admin users.

**Features:**
- **User Management:** list users, view details, disable/enable accounts, reset passwords
- **System Stats:** CPU, RAM, storage (overall), active containers, total users
- **Resource Usage:** per-user breakdown (tokens, storage, API calls)
- **Container Management:** list containers, status, start/stop, view logs
- **Billing Overview:** total revenue via Stripe (if commerce enabled)

**Database:**
```typescript
// Add to users table
role: enum('user', 'admin') default 'user'
isDisabled: boolean default false
```

### 5. Production Hardening

**Health Checks:**
- `GET /health` — basic liveness (returns 200 if server is up)
- `GET /ready` — readiness (checks DB, Redis, and essential services)

**Monitoring:**
- Structured JSON logging (replace console.log with pino or similar)
- Request logging middleware (method, path, status, duration)
- Error tracking: capture unhandled errors, store in DB or log

**Backup/Restore:**
- `scripts/backup.sh` — dumps PostgreSQL, copies workspace files, creates tarball
- `scripts/restore.sh` — restores from tarball
- Configurable backup destination (local, S3)
- Cron-compatible (add to user's crontab for scheduled backups)

**Deploy Script:**
- `scripts/deploy.sh` — one-line deploy:
  1. Pull latest images
  2. Run migrations
  3. Restart services
  4. Health check verification

**Docker Hub Publishing:**
- `Dockerfile` at project root for the complete app
- Multi-stage build (builder → runner)
- Target: `lexthecomputer/lex:latest` and `lexthecomputer/lex:x.y.z`
- GitHub Actions CI (if repo exists) for automated builds

**Landing Page:**
- Simple marketing page at `/` for unauthenticated users
- Hero: "Your personal AI computer. One command to deploy."
- Feature highlights with icons
- Quick start code block: `docker compose up`
- Screenshots placeholder
- Links to docs, GitHub, Discord
- "Get Started" → signup

### Env Vars (add to .env.example)
```
# Stripe Connect
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=

# Multi-user
MULTI_USER=false
CONTAINER_IDLE_TIMEOUT=1800
CONTAINER_CPU_LIMIT=1
CONTAINER_MEMORY_LIMIT=2g
CONTAINER_STORAGE_LIMIT=10g

# Admin
ADMIN_EMAIL=admin@example.com
```

## Implementation Order

1. Database: stripe tables, user_containers, usage_records, admin role
2. Stripe Connect: OAuth flow, account management
3. Stripe Products: CRUD, prices, payment links
4. Stripe Orders: webhook handler, list, fulfill, CSV export
5. Stripe AI tools (7 tools)
6. Frontend: Sell tab (Account/Products/Orders)
7. Multi-user: dockerode container lifecycle
8. Multi-user: tool execution routing (direct vs docker exec)
9. Multi-user: container base image
10. Usage metering + rate limiting
11. Admin dashboard (users, stats, containers, billing)
12. Health check endpoints
13. Structured logging + error tracking
14. Backup/restore scripts
15. Deploy script + Dockerfile
16. Landing page

## Acceptance Criteria
- [ ] Stripe Connect: create account, onboard, create product, get payment link
- [ ] Orders: webhook captures purchases, fulfill works, CSV export works
- [ ] AI tools: all 7 Stripe tools work from chat
- [ ] Sell tab: Account/Products/Orders all functional
- [ ] Multi-user: MULTI_USER=true → containers created per user
- [ ] Container isolation: users can't access each other's files
- [ ] Admin dashboard: shows users, stats, containers
- [ ] /health and /ready endpoints respond correctly
- [ ] backup.sh creates valid backup, restore.sh restores it
- [ ] Landing page renders for unauthenticated visitors
- [ ] Both packages build clean

## What NOT to Build Yet
- Subscription billing for the platform itself (users paying for Lex hosting)
- Desktop app (Phase 12)
