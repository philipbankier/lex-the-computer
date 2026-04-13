# R1 — Scaffold Hermes Harness Layer and Docker Foundation

## Changes

### New files
- `packages/api/app/harness/hermes.py` — HermesHarness implementation (HTTP client to Hermes OpenAI-compatible API)
- `packages/api/app/harness/factory.py` — `get_harness()` factory that returns HermesHarness or OpenClawHarness based on config
- `packages/api/app/services/hermes_config.py` — `generate_hermes_config()` produces config.yaml and .env content from onboarding selections
- `docker/hermes/Dockerfile.hermes` — Hermes container image extending `ghcr.io/nousresearch/hermes-agent:latest`
- `docker/hermes/config.yaml` — Default Hermes config (approvals off, compression 0.7, API server on port 8642)
- `docker/init-db.sql` — Creates `lex` and `honcho` PostgreSQL databases

### Modified files
- `packages/api/app/config.py` — Added `agent_harness`, `hermes_api_url`, `hermes_api_key`, `hermes_data_dir` settings
- `packages/api/app/harness/__init__.py` — Re-exports `get_harness` from factory
- `packages/api/app/routers/health.py` — Health endpoint now includes harness status via `harness.health_check()`

## Stub areas (for later phases)
- `HermesHarness.list_sessions()` / `get_session()` — returns empty (R5 will query state.db)
- `HermesHarness.send_message()` — uses Responses API streaming; SSE event mapping may need refinement in R3
