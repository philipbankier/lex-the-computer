# Lex the Computer — Monorepo (Phase 0)

This repo contains the Phase 0 scaffolding for Lex the Computer: a monorepo with a Next.js web app, a Hono API server, database schema (Drizzle), Docker Compose stack, and a tab-based UI shell.

Quick start
- Copy `.env.example` to `.env` and fill values.
- Install pnpm, then run `pnpm install`.
- Dev: `pnpm dev` (runs web + core).
- Docker: `docker compose up` (all services).

Packages
- `packages/web` — Next.js 15 app with tabbed UI shell and auth pages.
- `packages/core` — Hono API server with 501 route stubs and Drizzle schema.
- `packages/shared` — Shared types.

Docs
- See `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `docs/UI-AUDIT.md`, and `CODEX-TASK-PHASE0.md` for details.
