# Codex Task: Lex the Computer — Phase 1: Chat — The Core Experience

## Overview
Build the full AI chat system for Lex. This is the core product experience — multi-model streaming chat with @ mentions, personas, rules, BYOK, and AI tools. When done, a user should be able to have multi-turn conversations with any AI model, switch personas, use @ mentions for files/tools, and configure their own API keys.

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — full system architecture, data model, tech stack
- `PLAN.md` — Phase 1 section specifically
- `UI-AUDIT.md` — how Zo Computer's chat actually looks/works
- `RESEARCH.md` — complete feature map

## Existing Code
Phase 0 is complete. The monorepo is set up with:
- `packages/web/` — Next.js 15 + App Router + Tailwind 4 + shadcn/ui (app shell with sidebar, tab system, empty page shells)
- `packages/core/` — Hono API server with auth routes
- `packages/shared/` — Shared types
- Database schema in Drizzle ORM (all tables including conversations, messages, personas, rules, user_settings, etc.)
- Better Auth for email/password auth
- Docker Compose with web + core + postgres + redis + litellm

## Tech Stack for This Phase
- **AI SDK**: Vercel AI SDK (`ai` package) for streaming chat
- **LiteLLM**: Already in Docker Compose — use as AI proxy (http://litellm:4000)
- **UI Components**: shadcn/ui (already installed), Tailwind CSS 4
- **Editor**: For code blocks in chat, use syntax highlighting (e.g., `react-syntax-highlighter` or `shiki`)
- **Markdown**: `react-markdown` with `remark-gfm` for rendering AI responses

## Deliverables

### 1. Chat API (packages/core/)

#### Routes:
- `POST /api/chat/conversations` — Create new conversation
- `GET /api/chat/conversations` — List conversations (paginated, most recent first)
- `GET /api/chat/conversations/:id` — Get conversation with messages
- `PATCH /api/chat/conversations/:id` — Rename conversation
- `DELETE /api/chat/conversations/:id` — Delete conversation
- `POST /api/chat/conversations/:id/messages` — Send message + stream AI response (SSE)
- `POST /api/chat/conversations/:id/title` — Auto-generate title from first message

#### AI Integration:
- LiteLLM client wrapper: sends requests to http://litellm:4000/v1/chat/completions
- Streaming: use SSE (Server-Sent Events) for real-time token streaming
- System prompt builder function that assembles:
  1. User bio text
  2. Active persona's system prompt
  3. Active rules (filtered by condition matching)
  4. Available tools list (name + description)
  5. Any @ mentioned file contents
- Tool execution framework:
  - Tool definition format: `{ name, description, parameters (zod schema), execute function }`
  - When AI calls a tool → execute → return result → continue generation
  - Store tool calls + results in messages table

#### Built-in Tools (implement these):
- `web_search` — Search the web (use Brave Search API or SerpAPI — check env for API key)
- `read_webpage` — Fetch URL, extract text content (use `@mozilla/readability` or `cheerio`)
- `save_webpage` — Fetch URL → convert to markdown → save to workspace/articles/ folder

### 2. Personas API (packages/core/)
- `POST /api/personas` — Create persona
- `GET /api/personas` — List personas
- `PATCH /api/personas/:id` — Update persona
- `DELETE /api/personas/:id` — Delete persona
- `POST /api/personas/:id/activate` — Set as active persona
- Active persona stored in user_settings

### 3. Rules API (packages/core/)
- `POST /api/rules` — Create rule
- `GET /api/rules` — List rules
- `PATCH /api/rules/:id` — Update rule
- `DELETE /api/rules/:id` — Delete rule
- Rules have: name, condition (optional regex/keyword), prompt, is_active boolean
- Active rules are included in system prompt when condition matches (or always if no condition)

### 4. User Profile API (packages/core/)
- `GET /api/profile` — Get user profile (name, bio, avatar)
- `PATCH /api/profile` — Update profile
- `POST /api/profile/avatar` — Upload avatar image
- Bio text is included in system prompt for AI context

### 5. BYOK API (packages/core/)
- `GET /api/settings/providers` — List configured providers + keys (masked)
- `POST /api/settings/providers` — Add/update provider API key
- `DELETE /api/settings/providers/:provider` — Remove provider key
- When user adds a key → update LiteLLM config to include that provider
- Supported providers: OpenAI, Anthropic, Google (Gemini), Mistral, Groq, OpenRouter

### 6. Models API (packages/core/)
- `GET /api/models` — List available models (query LiteLLM /models endpoint)
- User can set default model in settings

### 7. Chat UI (packages/web/)

#### Main Chat Page (`/chat` or tab):
- **Left sidebar**: Conversation list
  - Search input at top
  - "New Chat" button
  - Conversation items showing title + last message preview + date
  - Click to switch, active conversation highlighted
  - Right-click or ... menu: Rename, Delete
- **Main area**: Chat messages
  - Message bubbles: user messages (right/colored), AI messages (left/plain)
  - AI messages: rendered markdown with code blocks, syntax highlighting, copy button
  - Tool call display: collapsible card showing tool name, input, output
  - Streaming indicator: typing dots or cursor while AI is generating
  - Auto-scroll to bottom on new messages
  - Timestamps on hover
- **Input area**:
  - Multi-line textarea (auto-grow)
  - @ mention trigger: typing `@` opens a popup with:
    - Files section: searchable file tree from workspace
    - Tools section: list of available tools
  - Selected @ mentions shown as chips/tags above input
  - Send button (+ Cmd/Ctrl+Enter shortcut)
  - Model picker dropdown (small, in input bar area)
  - Persona indicator (shows active persona name, click to switch)

#### Persistent Chat Sidebar:
- The Phase 0 shell has a right-side collapsible chat panel
- This should NOW be functional: full chat UI in the sidebar, available from any page
- Same functionality as main chat page but in a narrower layout

#### Conversation Title:
- New conversations start untitled
- After first AI response, auto-generate title (send first message pair to AI with "Generate a short title for this conversation")
- Show in conversation list

### 8. Personas UI (packages/web/)
- Settings page → AI tab → Personas section
- Persona list with cards: name, description, active indicator
- Create/Edit modal: name, description, system prompt (textarea)
- Activate button (only one active at a time)
- Delete with confirmation

### 9. Rules UI (packages/web/)
- Settings page → AI tab → Rules section  
- Rules list: name, condition, on/off toggle
- Create/Edit modal: name, condition (optional), prompt (textarea), active toggle
- Delete with confirmation

### 10. User Profile UI (packages/web/)
- Settings page → profile section (or dedicated profile page)
- Name input, Bio textarea, Avatar upload
- Save button
- Bio shown in "Your bio tells your AI about you" helper text

### 11. BYOK UI (packages/web/)
- Settings page → AI tab → API Keys / Providers section
- List of providers with key status (configured ✓ / not configured)
- Click to add/update key (masked input)
- Delete key button
- Help text: "Add your own API keys to use models from these providers"

### 12. Models UI (packages/web/)
- Settings page → AI tab → Models section (or in chat model picker)
- List available models grouped by provider
- Set default model
- Model picker in chat input area

## Key Implementation Notes

1. **Streaming**: Use Vercel AI SDK's `streamText` or implement raw SSE. The frontend should use `useChat` hook or custom SSE consumer.

2. **@ Mentions**: This is a key UX feature. When user types `@`:
   - Show a floating popup/dropdown
   - Two sections: "Files" (fetches from workspace) and "Tools" (static list)
   - Selecting a file adds its content to the message context
   - Selecting a tool tells the AI to use that specific tool
   - Show selected items as chips in the input area

3. **Tool Calls**: When the AI decides to use a tool:
   - Execute the tool server-side
   - Stream the tool call event to the frontend
   - Show tool call card in chat (collapsible)
   - Continue AI generation with tool result

4. **LiteLLM Configuration**: The `deploy/litellm/config.yaml` needs to be dynamically updated when users add BYOK keys. Either:
   - Use LiteLLM's admin API to add models at runtime
   - Or regenerate config and signal LiteLLM to reload

5. **Database**: All tables already exist from Phase 0 schema. Use them:
   - `conversations` table for conversation CRUD
   - `messages` table for message storage (role, content, tool_calls, tool_results)
   - `personas` table for persona CRUD
   - `rules` table for rules CRUD
   - `user_settings` for active persona, default model, bio, etc.

## Acceptance Criteria
- [ ] Can create new conversation and send messages
- [ ] AI responds with streaming (tokens appear in real-time)
- [ ] Can switch between multiple models (at least 2 models working)
- [ ] Markdown rendering works (headers, lists, code blocks with syntax highlighting)
- [ ] @ mention files: type @, see file list, select file, content added to context
- [ ] @ mention tools: type @, see tool list, select tool
- [ ] Tool calls work: web_search returns results, displayed in chat
- [ ] save_webpage tool saves article to files
- [ ] Personas: create, edit, delete, activate — active persona affects AI behavior
- [ ] Rules: create, edit, delete, toggle — active rules affect system prompt
- [ ] User bio: edit bio, bio appears in AI context
- [ ] BYOK: add API key for a provider, can use models from that provider
- [ ] Conversation list: shows all conversations, search works
- [ ] Conversation rename and delete work
- [ ] Auto-generated conversation titles
- [ ] Persistent chat sidebar works from any page
- [ ] Keyboard shortcuts: Cmd+Enter to send, Cmd+N new chat

## What NOT to Build Yet
- File browser/manager (Phase 2)
- Terminal (Phase 2)
- Automations (Phase 3)
- Sites/hosting (Phase 4)
- Space (Phase 5)
- Skills (Phase 6)
- OAuth integrations (Phase 7)
- Channel plugins like Telegram/email (Phase 8)
