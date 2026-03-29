# Lex the Computer — 2026 Remediation (Steps 1-7)

## Overview
Update the codebase to align with the March 2026 tech landscape. This covers foundation upgrades and media tool replacements.

## IMPORTANT: Read AUDIT-2026-03-29.md first for full context.

## Step 1: Upgrade Next.js 15 → 16

In `packages/web`:
- `npm install next@latest react@latest react-dom@latest`
- Next.js 16 changes:
  - Turbopack is now the default bundler
  - New caching model (fetch requests are NOT cached by default anymore — opt-in with `cache: 'force-cache'`)
  - React 19.2 ships with it
  - Update `next.config.js` → `next.config.ts` if not already
- Fix any breaking changes in routing, caching, or server components
- Verify all pages still build

## Step 2: Upgrade Vercel AI SDK → v6

- `npm install ai@latest @ai-sdk/openai@latest @ai-sdk/anthropic@latest` (and any other provider packages)
- AI SDK v6 changes:
  - `streamText` and `generateText` API refinements
  - `useChat` hook has updated options/return types
  - Server Actions pattern preferred over route handlers for streaming
  - Tool calling has refined types
- Update all chat-related code to v6 patterns
- Test streaming still works

## Step 3: Verify Tailwind CSS 4

Check `packages/web/package.json` for tailwindcss version.
- If on v3: migrate to v4
  - Remove `tailwind.config.js`, use CSS `@theme` directives instead
  - Update PostCSS config
  - Update any deprecated utilities
- If already on v4: no action needed

## Step 4: Add AI Providers Architecture

### Database
Add to schema:
```typescript
ai_providers: {
  id: uuid primaryKey
  userId: uuid references users
  type: enum('builtin', 'byok', 'claude-code', 'codex', 'gemini-cli')
  name: text not null           // "Claude Code", "Codex", "Gemini CLI", "OpenAI API Key", etc.
  isEnabled: boolean default false
  isAuthenticated: boolean default false  // for CLI providers: has the user authenticated?
  config: jsonb                 // provider-specific config (API keys for BYOK, model preferences, etc.)
  defaultModel: text            // default model for this provider
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Backend
- `GET /api/ai-providers` — list providers for user (with available/installed status)
- `PUT /api/ai-providers/:id` — enable/disable, update config
- `GET /api/ai-providers/detect` — detect which CLIs are installed (check `which claude`, `which codex`, `which gemini`)
- `GET /api/ai-providers/:id/models` — list available models for a provider
- `POST /api/ai-providers/:id/auth-status` — check if CLI provider is authenticated

For CLI providers (Claude Code, Codex, Gemini CLI):
- Detection: check if binary exists via `which`
- Auth status: check for auth tokens in expected locations
- Model routing: when user selects a CLI provider, route chat through the CLI tool rather than LiteLLM

### Frontend
- New "AI Providers" section in Settings (can replace or augment existing AI/BYOK settings)
- Cards for each provider type:
  - **Built-in** (default, uses LiteLLM credits)
  - **BYOK** (existing API key management)
  - **Claude Code** — shows: installed? authenticated? enable toggle, model selector
  - **Codex** — same pattern
  - **Gemini CLI** — same pattern
- Model picker in chat header shows provider source: "Claude Opus (via Claude Code)" or "GPT-4o (via BYOK)"

## Step 5: Replace Image Generation with fal.ai

- Remove old DALL-E 3 and Stability AI service code
- Install: `npm install @fal-ai/client` in packages/core
- New service `services/media/fal-image.ts`:
```typescript
import { fal } from "@fal-ai/client";

// Configure with FAL_KEY env var
fal.config({ credentials: process.env.FAL_KEY });

export async function generateImage(prompt: string, options?: {
  model?: string;  // 'flux-pro' | 'gpt-image' | 'recraft-v3' | 'ideogram-v3' | 'seedream'
  size?: string;
  style?: string;
}) {
  const modelMap = {
    'flux-pro': 'fal-ai/flux-pro/v1.1',
    'gpt-image': 'fal-ai/gpt-image',
    'recraft-v3': 'fal-ai/recraft-v3',
    'ideogram-v3': 'fal-ai/ideogram/v3',
    'seedream': 'fal-ai/seedream-3',
    'nano-banana': 'fal-ai/nano-banana-2',
  };
  const model = modelMap[options?.model || 'flux-pro'];
  return fal.subscribe(model, { input: { prompt, ...options } });
}

export async function editImage(imagePath: string, instruction: string) {
  // Use fal.ai editing models
}
```

- Update `generate-image` AI tool: add `model` param with options
- Update `edit-image` AI tool: use fal.ai
- Env var: `FAL_KEY` (add to .env.example)

## Step 6: Replace Video Generation with fal.ai

- Remove old Replicate/Stability video service code
- New service `services/media/fal-video.ts`:
```typescript
export async function generateVideo(imagePath: string, options?: {
  model?: string;  // 'kling' | 'veo' | 'wan'
  prompt?: string;
  duration?: number;
}) {
  const modelMap = {
    'kling': 'fal-ai/kling-video/v2/master/image-to-video',
    'veo': 'fal-ai/veo3',
    'wan': 'fal-ai/wan/v2.1/image-to-video',
  };
  // ...
}
```

- Update `generate-video` AI tool with model selector
- Same `FAL_KEY` env var

## Step 7: Add Groq Whisper for Transcription

- Add Groq as primary transcription provider
- Service `services/media/transcription.ts` update:
  - If `GROQ_API_KEY` is set: use Groq Whisper (whisper-large-v3) — 228x real-time speed
  - Else if `OPENAI_API_KEY` is set: fall back to OpenAI Whisper
  - Else: error "No transcription provider configured"
- Groq API for transcription:
```typescript
const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
  body: formData  // file + model: 'whisper-large-v3'
});
```
- Update `transcribe-audio` and `transcribe-video` tools
- Add `GROQ_API_KEY` to .env.example

## Build Verification
After all changes, ensure:
- [ ] `packages/web` builds clean (`pnpm build`)
- [ ] `packages/core` builds clean (`pnpm build`)
- [ ] No TypeScript errors
- [ ] Docker Compose still works

## Commit
Single commit: "Remediation 1/2: Next.js 16, AI SDK v6, AI Providers, fal.ai media, Groq Whisper"
