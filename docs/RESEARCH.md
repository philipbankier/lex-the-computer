# Lex the Computer — Complete Feature Audit

## Source: Zo Computer (zo.computer)
Comprehensive feature map from docs.zocomputer.com, user screenshots, and reviews.

---

## NAVIGATION STRUCTURE (from screenshots)

Bottom nav bar (mobile): **Files | Chats | Automations | Space | Skills | Menu**

This means Skills is a **first-class, top-level feature** — not a settings page.

---

## COMPLETE FEATURE MAP

### 1. CHAT (Core AI Interface)
| Feature | Description | Phase |
|---------|-------------|-------|
| Multi-model chat | GPT, Claude, Gemini, MiniMax, etc. | 1 |
| Streaming responses | SSE streaming with markdown rendering | 1 |
| Conversation history | Create, list, continue, rename, delete conversations | 1 |
| Model picker | Switch models per conversation or per message | 1 |
| @ mentions — files | Type @ to reference files from workspace (adds to context) | 1 |
| @ mentions — tools | Type @ to explicitly invoke a specific tool | 1 |
| Personas | Switchable AI personalities/modes (CRUD, activate) | 1 |
| Rules | Conditional behavior rules (condition + prompt, always-on) | 1 |
| Bio / profile | User bio gives AI persistent context about you | 1 |
| BYOK | Bring your own API keys for any provider | 1 |
| Claude Code as provider | Use your Claude Code subscription as an AI provider | 3 |
| Codex as provider | Use your OpenAI Codex subscription | 3 |
| Gemini CLI as provider | Use your Gemini CLI account | 3 |
| Structured output | JSON schema for programmatic responses | 7 |

### 2. FILES (Cloud Storage)
| Feature | Description | Phase |
|---------|-------------|-------|
| File browser | Tree view, grid/list, breadcrumbs | 2 |
| Upload/download | Drag & drop, multi-file upload | 2 |
| File viewer | Text, markdown (rendered), images, PDF, audio, video | 2 |
| Code editor | Syntax-highlighted editor with save | 2 |
| File operations | Rename, move, copy, delete, new folder | 2 |
| File search | Content search (ripgrep) + filename search | 2 |
| AI file ops | Read, create, edit, list, search files via AI tools | 2 |
| Chat about file | Click file → "Chat about this" → adds content to context | 2 |
| Save webpage | Send URL → AI saves content as article to Files | 2 |
| Articles folder | Auto-saved web articles organized by date | 2 |

### 3. AUTOMATIONS (Scheduled AI Tasks)
| Feature | Description | Phase |
|---------|-------------|-------|
| Create automation | Name, instruction, schedule, delivery method, model | 3 |
| Cron scheduling | One-time or recurring (daily, weekly, custom cron) | 3 |
| Delivery methods | Chat history, email, SMS, Telegram, Discord | 3 |
| AI execution | Runs with full user context (bio, rules, tools) | 3 |
| Run history/logs | View past runs with output and errors | 3 |
| AI tools | Create/edit/delete/list automations via chat | 3 |
| Default suggestions | Onboarding suggests first automation (daily briefing) | 6 |

### 4. SITES (Web Hosting)
| Feature | Description | Phase |
|---------|-------------|-------|
| Create site | AI scaffolds Hono + Bun project | 4 |
| Site editor | Split view: code (Monaco) + live preview (iframe) | 4 |
| Private preview | Authenticated-only URL for testing | 4 |
| Publish | Makes site public at slug.sites.yourdomain.com | 4 |
| Custom domains | CNAME + auto TLS via Caddy | 4 |
| SQLite database | Per-site SQLite database with built-in explorer | 4 |
| File integration | Sites can read/write workspace files | 4 |
| CLAUDE file | Per-site instructions file for the AI coding agent | 4 |
| AI tools | Create, edit, publish, unpublish sites via chat | 4 |
| External packages | AI can install npm packages for sites | 4 |

### 5. SPACE (Personal Domain)
| Feature | Description | Phase |
|---------|-------------|-------|
| Personal URL | handle.space.yourdomain.com | 5 |
| Pages | React components rendered as pages (Tailwind, Lucide) | 5 |
| API endpoints | Backend endpoints that return data (always public) | 5 |
| Asset uploads | Images/files as public assets | 5 |
| Version history | Undo/redo per route | 5 |
| Public/private toggle | Per-page visibility control | 5 |
| AI tools | Create/edit/delete routes, upload assets | 5 |
| Error checking | View recent errors from space routes | 5 |

### 6. SKILLS (Agent Capabilities) ⭐ TOP-LEVEL FEATURE
| Feature | Description | Phase |
|---------|-------------|-------|
| Skills page | Top-level navigation (same level as Files, Chats, etc.) | 6 |
| Installed tab | View/manage installed skills | 6 |
| Skills Hub tab | Community marketplace — browse, search, install skills | 6 |
| Create Skill | Wizard or chat-based skill creation | 6 |
| Open Folder | Direct access to skill's directory in file browser | 6 |
| Skill cards | Name, author, description, Install/Uninstall button | 6 |
| AgentSkills format | SKILL.md with frontmatter (name, description, metadata) | 6 |
| Skill directory | Skills/<name>/SKILL.md + scripts/ + references/ + assets/ | 6 |
| Progressive loading | Only loads full skill when task matches description | 6 |
| AI can create skills | AI tool to create new skills (skill-creator pattern) | 6 |
| Custom integrations as skills | AI builds OAuth integrations packaged as skills | 6 |
| GitHub submission | Submit skills to community hub via PR | 6 |

### 7. INTEGRATIONS (Third-Party Connections)
| Feature | Description | Phase |
|---------|-------------|-------|
| OAuth2 framework | Generic OAuth flow for all integrations | 7 |
| Gmail | Read inbox, send email (Read Only / Read & Write) | 7 |
| Google Calendar | Read/write events | 7 |
| Notion | Read/write pages | 7 |
| Google Drive | Read/write files | 7 |
| Dropbox | Read/write files | 7 |
| Airtable | Read/write tables | 7 |
| Linear | Read/write issues | 7 |
| Spotify | Read/write music library | 8 |
| GitHub | Connect GitHub account | 7 |
| Multiple accounts | Multiple accounts per integration (personal + work) | 7 |
| Permission levels | Read Only vs Read & Write per account | 7 |
| Custom integrations | AI builds new integrations as Skills | 7 |
| AI tools per integration | use-gmail, use-calendar, use-notion, etc. | 7 |

### 8. CHANNELS (Multi-Surface Access)
| Feature | Description | Phase |
|---------|-------------|-------|
| Web chat | Primary interface | 1 |
| Telegram | Send/receive messages, file attachments | 8 |
| Email | Per-user handle@yourdomain.com, inbound + outbound | 8 |
| SMS | Twilio-based text messaging | 8 |
| Discord | Bot integration | 8 |
| Per-channel personas | Different persona per channel | 8 |
| File attachments | Send/receive files via channels | 8 |

### 9. SERVICES (Process Hosting)
| Feature | Description | Phase |
|---------|-------------|-------|
| Register service | Define HTTP or TCP service on a port | 4 |
| Service management | Start, stop, restart, delete services | 4 |
| Public URLs | HTTP proxy URL + Direct tunnel URL | 4 |
| Service diagnostics | Service doctor tool for debugging | 4 |
| Environment vars | Per-service env configuration | 4 |
| AI tools | Create, update, delete, list, diagnose services | 4 |

### 10. TERMINAL
| Feature | Description | Phase |
|---------|-------------|-------|
| Web terminal | xterm.js shell access to workspace | 2 |
| Run commands | Full shell (bash) in workspace | 2 |
| AI shell exec | AI can run shell commands as a tool | 2 |

### 11. BROWSER USE
| Feature | Description | Phase |
|---------|-------------|-------|
| AI browser | AI has its own browser instance | 9 |
| Browse web | AI can view and interact with webpages | 9 |
| Logged-in access | User can log into sites in AI's browser | 9 |
| Site interaction | AI can interact with logged-in sites (e.g., X feed) | 9 |

### 12. SELLING (Commerce)
| Feature | Description | Phase |
|---------|-------------|-------|
| Stripe Connect | Connect Stripe account | 10 |
| Create products | Name, description, price | 10 |
| Payment links | Generate shareable payment URLs | 10 |
| Order management | View orders, mark fulfilled, export CSV | 10 |
| 0% platform fee | Only Stripe's processing fees | 10 |
| AI tools | Create products, payment links, manage orders | 10 |
| Site integration | Embed payment links in Zo sites | 10 |

### 13. SSH / REMOTE ACCESS
| Feature | Description | Phase |
|---------|-------------|-------|
| SSH to Lex | Use Lex as remote dev environment via SSH | 9 |
| SSH to other computers | Control remote machines from Lex | 10 |
| ngrok-like tunneling | Proxy local services to public URLs | 4 |

### 14. API
| Feature | Description | Phase |
|---------|-------------|-------|
| POST /api/ask | Send message, get AI response | 7 |
| Streaming | SSE streaming via stream: true | 7 |
| GET /models | List available models | 7 |
| GET /personas | List personas | 7 |
| API keys | Create, revoke, manage access tokens | 7 |
| Structured output | JSON schema in output_format | 7 |
| Conversation threading | conversation_id for multi-turn | 7 |

### 15. MCP SERVER
| Feature | Description | Phase |
|---------|-------------|-------|
| MCP endpoint | Expose all Lex tools via Model Context Protocol | 9 |
| Claude Code | Config for Claude Code MCP integration | 9 |
| Cursor | Config for Cursor MCP integration | 9 |
| Gemini CLI | Config for Gemini CLI MCP integration | 9 |
| Any MCP client | Standard MCP protocol support | 9 |

### 16. DESKTOP APP
| Feature | Description | Phase |
|---------|-------------|-------|
| Desktop app | Electron/Tauri wrapper of web UI | 10 |
| File sync | Sync local folders ↔ Lex workspace | 10 |
| SyncThing alt | Alternative sync via SyncThing | 10 |

### 17. AI TOOLS (Complete List)
Zo has 60+ tools. Here's the full categorized list:

**File Operations:**
- create-or-rewrite-file, edit-file, edit-file-llm (fast apply), read-file, list-files, grep-search

**Shell:**
- run-bash-command, run-parallel-cmds, run-sequential-cmds

**Web:**
- open-webpage (browser), read-webpage, save-webpage, image-search, find-similar-links, maps-search

**AI/Media:**
- generate-image, edit-image, generate-video, generate-d2-diagram, transcribe-audio, transcribe-video

**Sites:**
- create-website, publish-site, unpublish-site

**Space:**
- get-space-route, update-space-route, delete-space-route, list-space-routes, get-space-route-history, undo-space-route, redo-space-route, update-space-asset, delete-space-asset, list-space-assets, get-space-errors, get-space-settings, update-space-settings, restart-space-server

**Automations:**
- create-agent, edit-agent, delete-agent, list-agents

**Communication:**
- send-email-to-user, send-sms-to-user, send-telegram-message, send-discord-message

**Services:**
- register-user-service, update-user-service, delete-user-service, list-user-services, service-doctor, proxy-local-service

**Integrations:**
- use-app-gmail, use-app-google-calendar, use-app-google-drive, use-app-dropbox, use-app-airtable, use-app-notion, use-app-linear, use-app-spotify, list-app-tools

**Commerce:**
- create-stripe-product, create-stripe-price, create-stripe-payment-link, update-stripe-payment-link, update-stripe-product, list-stripe-payment-links, list-stripe-orders, update-stripe-orders

**Personas/Rules/Settings:**
- create-persona, edit-persona, delete-persona, list-personas, set-active-persona
- create-rule, edit-rule, delete-rule, list-rules
- update-user-settings

**Infrastructure:**
- change-hardware, connect-telegram

---

## ONBOARDING (from Philip's screenshots)

1. Welcome → Create account → Choose handle
2. Tell Lex about yourself (bio, interests)
3. Add social links
4. Choose persona
5. First automation suggestion (daily briefing)
6. Connect channels (Telegram, email provisioned automatically)
7. Ready screen: shows Space URL, email address, quick actions
8. First chat: AI greets with context from bio, confirms automation

---

## OPEN-SOURCE COMPONENTS TO LEVERAGE

| Need | Solution | Notes |
|------|----------|-------|
| AI orchestration | LiteLLM proxy | Multi-model, BYOK, cost tracking |
| Chat UI | Vercel AI SDK + shadcn/ui | Streaming, markdown, tool displays |
| Web framework | Next.js 15 | App Router, RSC, great DX |
| API server | Hono | Lightweight, TypeScript-first |
| Database | PostgreSQL + Drizzle | Type-safe, migrations |
| Job queue | BullMQ + Redis | Cron, retries, rate limiting |
| Reverse proxy | Caddy | Auto HTTPS, dynamic config API |
| Code editor | Monaco Editor | VS Code's editor |
| Terminal | xterm.js | Full terminal emulation |
| File sync | SyncThing | Or custom via WebSocket |
| Skills format | AgentSkills spec | Same as OpenClaw + Zo |
| Skills hub | GitHub repo + registry API | Community skills via git |
| AI browser | Playwright | Headless browser for AI |
| MCP | @modelcontextprotocol/sdk | Standard MCP server impl |
| Desktop app | Tauri v2 | Lightweight, cross-platform |
| Email inbound | Cloudflare Email Workers | Free, or Postal/Mailgun |
| SMS | Twilio | Industry standard |
| OAuth | Custom + arctic library | Lightweight OAuth2 |

---

### 18. DATASETS (New — discovered via live UI audit)
| Feature | Description | Phase |
|---------|-------------|-------|
| Create dataset | Turn messy exports into structured datasets | 8 |
| DuckDB backend | Data stored as datapackage.json + schema.yaml + data.duckdb | 8 |
| Data explorer | Browse, query, chart datasets in UI | 8 |
| AI analysis | Ask questions about datasets, discover patterns | 8 |

### 19. SYSTEM (Server Management)
| Feature | Description | Phase |
|---------|-------------|-------|
| System stats | CPU, RAM, processes, uptime, architecture | 9 |
| Network speed test | Run bandwidth test | 9 |
| System restore | Restore to previous state | 11 |
| Reboot | Restart server | 9 |

### 20. UX / THEMES
| Feature | Description | Phase |
|---------|-------------|-------|
| Theme system | 20+ named themes beyond light/dark/system | 9 |
| Keybindings | Configurable keyboard shortcuts | 9 |
| Show hidden files | Developer toggle for dotfiles | 2 |

### 21. SECRETS / ENV VARS
| Feature | Description | Phase |
|---------|-------------|-------|
| Secrets manager | Key-value env vars for scripts and routes | 4 |
| .env paste support | Paste full .env files | 4 |
| Used by sites/scripts | Available when running code | 4 |

### 22. ADDITIONAL INTEGRATIONS (found in live UI)
| Feature | Description | Phase |
|---------|-------------|-------|
| OneDrive | Microsoft OneDrive file access | 8 |
| Google Tasks | Task list management | 8 |
| Microsoft Outlook | Email management | 8 |
| Pipedream | OAuth partner (SOC 2 compliant) | 7 |

---

## COMPLETE NAVIGATION MAP (from live UI audit)

### Sidebar (always visible)
- Home (dashboard/bookmarks)
- Files
- Search (overlay/modal)
- Chats
- Automations
- Space
- Skills

### More Menu (expandable)
- Hosting (Sites & Services)
- Datasets
- System
- Terminal
- Billing
- Resources
- Bookmarks
- Settings

### Settings Tabs
- AI (Models, Personas, Providers, Personalization, Rules)
- Channels (Text, Email, Telegram — each with per-channel persona+model)
- Integrations (Connections, Browser, Payments)
- UX (Themes, Keybindings, Show hidden files)
- Advanced (Secrets, Access Tokens, Delete Account)

---

## WHAT ZO HAS THAT IS MANAGED-ONLY (skip for open-source)

- GPU hardware scaling (change-hardware tool)
- Gift system (give Zo to friends)
- Subscription billing / plan management
- Cloudflare edge for custom domains (we use Caddy instead)
- Their Substrate inference platform (we use LiteLLM)
