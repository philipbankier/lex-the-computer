# Codex Task: Lex the Computer — Phase 10: Advanced Features

## Overview
Build **power features**: AI browser (Playwright), MCP server, image/audio/video tools, diagram generation, SSH connectivity, and additional integrations. These are the features that make Lex a truly capable AI computer.

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — system architecture
- `PLAN.md` — Phase 10 section
- Look at existing code patterns from Phases 7-9 for consistency

## What Already Exists (Phases 0–9 complete)
- Everything: chat, files, automations, sites, space, skills, integrations (7 providers), channels (4), onboarding, dashboard, 20 themes, datasets/DuckDB, system page, docs

## Phase 10 Requirements

### 1. AI Browser (Playwright)

**Backend:**
- Install `playwright` with chromium browser
- Browser pool: manage headless browser instances per user
- Persistent browser contexts (cookies/sessions survive between calls)

**Service** (`services/browser.ts`):
- `navigateTo(url)` → go to URL, return page title + text content
- `screenshot(url?)` → capture screenshot, save to workspace
- `clickElement(selector)` → click an element
- `typeText(selector, text)` → type into input
- `extractContent(selector?)` → extract text/HTML from page
- `evaluateScript(code)` → run JS in page context
- `getPageInfo()` → current URL, title, links, forms
- `loginToSite(url)` → opens browser for user to log in (saves session)
- `listSessions()` → show saved browser sessions/cookies

**AI Tools:**
- `browse-web` — params: url, action (navigate/screenshot/click/type/extract/evaluate), selector?, text?
- `browser-session` — params: action (list/login/delete), url?

**Settings (AI → Browser section):**
- List of saved browser sessions (site + last used)
- "Log into site" button → opens URL, user logs in, session saved
- Delete session button

### 2. MCP Server (Model Context Protocol)

**Endpoint:** `POST /mcp` and `GET /mcp` (SSE for streaming)

Implement the MCP specification to expose all Lex tools as MCP tools:
- Tool discovery: `tools/list` → returns all available tools with schemas
- Tool execution: `tools/call` → executes tool, returns result
- Resource listing: `resources/list` → list files, conversations, etc.
- Resource reading: `resources/read` → read file content, conversation history

**Auth:** API key in Authorization header (reuse existing API key system)

**Tools to expose via MCP** (all existing AI tools):
- Chat tools (web search, read webpage, save webpage)
- File tools (read, create, edit, list, search, run command)
- Automation tools (create, edit, delete, list)
- Site tools (create, publish, unpublish)
- Space tools (create route, edit, delete, list, assets)
- Skill tools (create, list, install, uninstall)
- Integration tools (gmail, calendar, notion, drive, etc.)
- Channel tools (send telegram, email, discord, sms)
- Dataset tools (query dataset)
- Browser tools (new from above)
- All new tools from this phase

**Config examples** (create `docs/MCP-SETUP.md`):
```json
// Claude Code (~/.claude.json)
{
  "mcpServers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer lex_your_api_key" }
    }
  }
}

// Cursor (.cursor/mcp.json)
// Gemini CLI
// Zed (settings.json)
// OpenCode
```

### 3. Image Generation Tool

**Service** (`services/media/image-gen.ts`):
- Support multiple providers via env vars:
  - OpenAI DALL-E 3 (`OPENAI_API_KEY`)
  - Stability AI (`STABILITY_API_KEY`)
  - Replicate (`REPLICATE_API_TOKEN`)
- `generateImage(prompt, options?)` → generates image, saves to workspace/files/
- Options: size (1024x1024, 1792x1024, etc.), style (natural/vivid), quality (standard/hd)

**AI Tool:** `generate-image` — params: prompt, size?, style?, provider?

### 4. Image Editing Tool

**Service** (`services/media/image-edit.ts`):
- `editImage(imagePath, instruction)` → AI-powered edit (using DALL-E edit or Stability inpaint)
- `removeBackground(imagePath)` → remove background
- `upscale(imagePath, factor?)` → upscale image

**AI Tool:** `edit-image` — params: imagePath, action (edit/remove-bg/upscale), instruction?

### 5. Audio Transcription (Whisper)

**Service** (`services/media/transcription.ts`):
- Use OpenAI Whisper API (`OPENAI_API_KEY`) or local whisper if available
- `transcribeAudio(filePath)` → returns text transcription
- `transcribeWithTimestamps(filePath)` → returns timestamped segments
- Supports: mp3, wav, m4a, ogg, flac, webm

**AI Tool:** `transcribe-audio` — params: filePath, timestamps? (boolean)

### 6. Video Transcription

**Service** (`services/media/video-transcription.ts`):
- Extract audio from video using ffmpeg
- Send to Whisper for transcription
- `transcribeVideo(filePath)` → returns text transcription with timestamps

**AI Tool:** `transcribe-video` — params: filePath

### 7. Video Generation

**Service** (`services/media/video-gen.ts`):
- Use Replicate or Stability AI video models
- `generateVideo(imagePath, prompt?, duration?)` → short video clip from image
- Save to workspace/files/

**AI Tool:** `generate-video` — params: imagePath, prompt?, duration?

### 8. Diagram Generation (D2)

**Service** (`services/media/diagrams.ts`):
- Use D2 diagram language (install `d2` CLI or use d2 JS library)
- `generateDiagram(d2Code, format?)` → renders diagram as SVG/PNG
- `diagramFromDescription(description)` → AI generates D2 code, then renders

**AI Tools:**
- `create-diagram` — params: code (D2 language), format? (svg/png)
- `describe-diagram` — params: description (natural language) → AI generates D2 → renders

### 9. Google Maps Search

**Service** (`services/integrations/maps.ts`):
- Use Google Places API (`GOOGLE_MAPS_API_KEY`)
- `searchPlaces(query, location?)` → returns places with name, address, rating, hours
- `getPlaceDetails(placeId)` → detailed info
- `getDirections(from, to, mode?)` → route info

**AI Tool:** `search-maps` — params: query, location?, action? (search/details/directions)

### 10. SSH Connectivity

**Backend:**

**Service** (`services/ssh.ts`):
- Use `ssh2` npm package
- `connect(host, user, keyPath?)` → establish SSH connection
- `exec(connectionId, command)` → run command on remote
- `upload(connectionId, localPath, remotePath)` → SCP upload
- `download(connectionId, remotePath, localPath)` → SCP download
- `disconnect(connectionId)` → close connection

**Database:**
```typescript
ssh_keys: {
  id: uuid primaryKey
  userId: uuid references users
  name: text not null           // "Home Server", "VPS", etc.
  host: text not null
  port: integer default 22
  username: text not null
  privateKey: text              // encrypted PEM key
  passphrase: text              // encrypted
  fingerprint: text             // server fingerprint for verification
  lastConnected: timestamp
  createdAt: timestamp
}
```

**API:**
- `GET /api/ssh/keys` — list saved SSH connections
- `POST /api/ssh/keys` — add SSH connection (host, user, key)
- `DELETE /api/ssh/keys/:id` — remove
- `POST /api/ssh/keys/:id/test` — test connection
- `POST /api/ssh/exec` — execute command on remote host

**AI Tools:**
- `ssh-exec` — params: host (name or id), command
- `ssh-upload` — params: host, localPath, remotePath
- `ssh-download` — params: host, remotePath, localPath

**Frontend (Terminal page enhancement):**
- SSH connections sidebar in terminal
- Click connection → opens SSH terminal session (xterm.js → WebSocket → ssh2)
- SSH key manager in Settings → Advanced

### 11. Additional Integrations

Add to the existing integration framework (same pattern as Phase 7):

**Airtable** (`services/integrations/airtable.ts`):
- API key based (env: `AIRTABLE_API_KEY`)
- `listBases()`, `listTables(baseId)`, `listRecords(baseId, tableId, filter?)`, `createRecord(...)`, `updateRecord(...)`
- AI tool: `use-airtable`

**Spotify** (`services/integrations/spotify.ts`):
- OAuth2 (env: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`)
- `searchTracks(query)`, `getCurrentPlayback()`, `getPlaylists()`, `play(uri)`, `pause()`, `skipNext()`
- AI tool: `use-spotify`

**OneDrive** (`services/integrations/onedrive.ts`):
- OAuth2 via Microsoft (env: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`)
- `searchFiles(query)`, `getFile(itemId)`, `downloadFile(itemId)`, `uploadFile(path, content)`
- AI tool: `use-onedrive`

**Google Tasks** (`services/integrations/google-tasks.ts`):
- Uses existing Google OAuth (add tasks scope)
- `listTaskLists()`, `listTasks(listId)`, `createTask(listId, title, notes?)`, `completeTask(taskId)`, `deleteTask(taskId)`
- AI tool: `use-google-tasks`

**Microsoft Outlook** (`services/integrations/outlook.ts`):
- OAuth2 via Microsoft (reuse Microsoft OAuth from OneDrive)
- `searchEmails(query)`, `getEmail(emailId)`, `sendEmail(to, subject, body)`, `listFolders()`
- AI tool: `use-outlook`

### Frontend Updates

**Settings → Integrations:**
- Add cards for: Airtable, Spotify, OneDrive, Google Tasks, Outlook
- Same connect/disconnect pattern as existing integrations

**Settings → AI → Browser:**
- Saved browser sessions list
- "Log into site" flow

**Settings → Advanced → SSH:**
- SSH key/connection manager
- Add/edit/delete/test connections

**Terminal page:**
- SSH connections in sidebar
- Click to open remote terminal

## Implementation Order

1. AI Browser: Playwright service + browser tools + settings UI
2. MCP Server: endpoint + tool/resource discovery + auth + docs
3. Image generation: DALL-E/Stability service + tool
4. Image editing: edit/remove-bg/upscale + tool
5. Audio transcription: Whisper service + tool
6. Video transcription: ffmpeg + Whisper + tool
7. Video generation: Replicate/Stability + tool
8. Diagram generation: D2 service + tools
9. Google Maps: Places API service + tool
10. SSH: ssh2 service + key management + terminal integration + tools
11. Additional integrations: Airtable, Spotify, OneDrive, Google Tasks, Outlook
12. Frontend updates: all new settings sections, terminal SSH sidebar
13. MCP setup docs

## Acceptance Criteria
- [ ] AI can browse websites, click elements, fill forms, take screenshots
- [ ] Browser sessions persist (logged-in sites stay logged in)
- [ ] MCP endpoint works with Claude Code (test with config example)
- [ ] MCP exposes all Lex tools
- [ ] Image generation works (DALL-E or Stability)
- [ ] Audio/video transcription works
- [ ] Diagram generation works (D2)
- [ ] SSH: can connect to remote host, run commands, transfer files
- [ ] SSH terminal works in browser
- [ ] All 5 new integrations have working services + AI tools
- [ ] Both `packages/web` and `packages/core` build clean

## What NOT to Build Yet
- Commerce / Stripe (Phase 11)
- Multi-user mode (Phase 11)
- Desktop app (Phase 12)
