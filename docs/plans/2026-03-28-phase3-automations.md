# Phase 3: Automations

## Overview
Build scheduled AI tasks ("automations" / "agents"). Users create automations with an instruction and schedule — the system runs them on cron, executes the AI with full context (bio, persona, rules, tools), and delivers results via chat, email, or other channels. This is the "set it and forget it" feature.

## Existing Code
- Database tables exist: `automations` (id, user_id, name, instruction, schedule, model, delivery_method, is_active, persona_id, created_at, updated_at) and `automation_runs` (id, automation_id, status, output, error, started_at, completed_at)
- `packages/web/app/(app)/automations/page.tsx` — empty shell
- `packages/core/src/index.ts` — has placeholder routes for automations (501)
- All Phase 1 + 2 tools available (web_search, read_webpage, save_webpage, create_file, edit_file, list_files, search_files, run_command, etc.)
- System prompt builder in `packages/core/src/services/prompt.ts`
- LiteLLM client in `packages/core/src/lib/litellm.ts`

## Phase 3a: Backend — BullMQ Job Queue

1. Add `bullmq` and `ioredis` to core package.json dependencies
2. Create `packages/core/src/lib/queue.ts`:
   - Initialize IORedis connection (use `REDIS_URL` env var, default `redis://localhost:6379`)
   - Create BullMQ Queue named `automations`
   - Create BullMQ Worker that processes automation jobs
   - Export queue instance and helper functions
3. Add `REDIS_URL` to `packages/core/src/lib/env.ts`

## Phase 3b: Backend — Automation Execution Engine

4. Create `packages/core/src/services/automation-runner.ts`:
   - `runAutomation(automationId: number)` function that:
     a. Loads the automation from DB
     b. Builds system prompt using `buildSystemPrompt()` with the automation's persona
     c. Sends the automation instruction to LiteLLM (non-streaming, since no user is watching)
     d. AI has access to ALL tools — if the AI calls a tool, execute it and continue
     e. Saves the run to `automation_runs` table with status/output/error
     f. Handles delivery: creates a conversation with the output (delivery_method = 'chat')
   - For non-streaming execution, add a `chatCompletion()` function to `litellm.ts` that makes a non-streaming request and returns the full response

## Phase 3c: Backend — Automations CRUD API

5. Create `packages/core/src/routes/automations.ts`:
   - `POST /api/automations` — Create automation. Body: `{ name, instruction, schedule, model, delivery_method, persona_id }`. After creating, add/update the BullMQ repeatable job based on the schedule.
   - `GET /api/automations` — List all automations for the user (with last run info)
   - `GET /api/automations/:id` — Get automation details
   - `PATCH /api/automations/:id` — Update automation (name, instruction, schedule, etc.). Update the BullMQ repeatable job.
   - `DELETE /api/automations/:id` — Delete automation + remove BullMQ job
   - `POST /api/automations/:id/toggle` — Toggle is_active. When deactivated, remove BullMQ job. When activated, add it back.
   - `POST /api/automations/:id/run` — Manually trigger a run (for testing)
   - `GET /api/automations/:id/runs` — List run history (paginated, most recent first)
   - `GET /api/automations/:id/runs/:runId` — Get specific run output

6. Wire automations router in `packages/core/src/index.ts` (replace the notImplemented stubs)

## Phase 3d: Backend — AI Automation Tools

7. Create tools in `packages/core/src/tools/`:
   - `create_automation` — AI can create an automation (name, instruction, schedule, delivery_method)
   - `edit_automation` — AI can update an existing automation
   - `delete_automation` — AI can delete an automation
   - `list_automations` — AI can list user's automations
8. Register these tools in the chat route's toolsList

## Phase 3e: Frontend — Automations UI

Update `packages/web/app/(app)/automations/page.tsx`:

9. **Automation list view**:
   - Cards for each automation showing: name, schedule (human-readable), status (active/paused), last run time + status, delivery method
   - Active/Paused toggle on each card
   - Click card to view details
   - "New Automation" button

10. **Create/Edit automation form** (modal or inline):
   - Name input
   - Instruction textarea (the prompt that will be sent to the AI)
   - Schedule picker:
     - Preset buttons: Every day, Every week, Every month
     - Custom: cron expression input with preview of next run time
     - One-time: date/time picker for future scheduling
   - Model override dropdown (optional — defaults to user's default model)
   - Delivery method selector: Chat (default), Email, Telegram
   - Persona override dropdown (optional)
   - Save / Cancel buttons

11. **Automation detail view**:
   - Shows automation config
   - Edit button
   - "Run Now" button (manual trigger)
   - Run history list: each run shows started_at, status (success/error), output preview
   - Click run to see full output + any errors

12. **Filter tabs** (from the shell): None (all), Email, SMS, Telegram, Paused — filter automations by delivery_method or status

## Phase 3f: Cron Schedule Helpers

13. Create `packages/core/src/lib/cron.ts`:
   - `parseCronToHuman(cron: string): string` — Convert cron expression to readable text (e.g., "Every day at 9:00 AM")
   - `getNextRun(cron: string): Date` — Calculate next execution time
   - Helper presets: `DAILY_9AM = '0 9 * * *'`, `WEEKLY_MON = '0 9 * * 1'`, `MONTHLY_1ST = '0 9 1 * *'`

14. Create shared utility on frontend for displaying schedule info

## Acceptance Criteria
- [ ] Can create automation via UI with name, instruction, schedule
- [ ] Automation runs on schedule (BullMQ cron job fires)
- [ ] AI executes with full context (bio, persona, rules, tools)
- [ ] AI can use tools during automation run (e.g., search web, create files)
- [ ] Run output saved to automation_runs table
- [ ] Run delivered as chat conversation
- [ ] Run history viewable with output and errors
- [ ] Toggle active/paused works (removes/adds BullMQ job)
- [ ] Manual "Run Now" trigger works
- [ ] AI tools: create_automation, edit_automation, delete_automation, list_automations
- [ ] Schedule picker works (presets + custom cron)
- [ ] Automation list shows correct status and last run info

## What NOT to Build Yet
- Email/SMS/Telegram delivery (Phase 8 — just save the output field for now, deliver to chat only)
- Claude Code / Codex / Gemini CLI as providers (deferred — just use LiteLLM models)
- Sites (Phase 4)
- Space (Phase 5)
- Skills (Phase 6)
