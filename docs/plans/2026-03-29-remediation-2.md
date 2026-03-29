# Lex the Computer — 2026 Remediation Part 2 (Steps 8-13)

## Step 8: Rewrite MCP Server

Remove the existing custom MCP implementation entirely. Replace with the official SDK.

### Install
```bash
npm install @modelcontextprotocol/sdk zod
```

### Implementation (`packages/core/src/routes/mcp.ts`)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';

// Create MCP server
const mcpServer = new McpServer({
  name: 'lex-computer',
  version: '1.0.0',
});

// Register ALL existing Lex tools as MCP tools
// Each tool from the AI tool system gets registered:
// - File tools: read-file, create-file, edit-file, edit-file-llm, list-files, search-files, run-command
// - Chat tools: web-search, read-webpage, save-webpage
// - Space tools: create/edit/delete space routes, assets, settings
// - Automation/Agent tools: create/edit/delete/list agents
// - Integration tools: use-gmail, use-calendar, use-notion, etc.
// - Media tools: generate-image, edit-image, generate-video, transcribe-audio
// - Channel tools: send-telegram, send-email, send-discord, send-sms
// - Browser tools: browse-web
// - Dataset tools: query-dataset
// - Skill tools: create/list/install/uninstall skills
// Use zod schemas for input validation

// Register resources
// - Files as resources (list workspace files)
// - Conversations as resources

// Hono route handler
app.post('/mcp', async (c) => {
  // Validate Bearer token (reuse API key auth)
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const apiKey = authHeader.slice(7);
  const user = await validateApiKey(apiKey);
  if (!user) return c.json({ error: 'Invalid API key' }, 401);

  // Create transport and handle request
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  // ... handle request/response bridge with Hono
});
```

### MCP Setup Docs (`docs/MCP-SETUP.md`)
Create config examples for every major MCP client, matching Zo's format exactly:

**Claude Code:**
```bash
claude mcp add --transport http lex http://localhost:3001/mcp \
  --header "Authorization: Bearer lex_your_api_key"
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "lex": {
      "command": "npx",
      "args": ["mcp-remote@latest", "http://localhost:3001/mcp", "--header", "Authorization: Bearer lex_your_key"]
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer lex_your_key" }
    }
  }
}
```

**Zed** (`settings.json`):
```json
{
  "context_servers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer lex_your_key" }
    }
  }
}
```

**OpenCode** (`opencode.json`):
```json
{
  "mcp": {
    "lex": {
      "type": "remote",
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer lex_your_key" }
    }
  }
}
```

**Gemini CLI:**
```json
{
  "mcpServers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer lex_your_key" }
    }
  }
}
```

## Step 9: Enhance Browser Automation with Stagehand

### Install
```bash
npm install @browserbasehq/stagehand
```

### Update browser service
Keep Playwright as the base. Add Stagehand wrapper for AI-powered interactions:

```typescript
import { Stagehand } from '@browserbasehq/stagehand';

// For AI-powered browsing (natural language)
const stagehand = new Stagehand({ env: 'LOCAL' });
await stagehand.init();
await stagehand.page.goto(url);

// Natural language actions
await stagehand.act({ action: "click the login button" });
const data = await stagehand.extract({
  instruction: "extract the article title and body text",
  schema: z.object({ title: z.string(), body: z.string() }),
});
const elements = await stagehand.observe({ instruction: "what buttons are visible?" });
```

### Update `browse-web` tool
- Add `mode` param: `'navigate'` (basic Playwright) or `'interact'` (Stagehand AI)
- For `interact` mode: use Stagehand's `act()`, `extract()`, `observe()`
- Stagehand v3 has action caching — repeated actions skip LLM calls

## Step 10: Add Missing Tools

### 10a: `proxy-local-service`
- Creates a TCP tunnel to expose a local port publicly (like ngrok)
- Implementation options: use `localtunnel` npm package, or Cloudflare Tunnel API
- Params: localPort, subdomain (optional)
- Returns: public URL
- Add to services router

### 10b: `service-doctor`
- AI-powered service diagnostics
- Checks: process running? port responding? logs contain errors? dependencies installed?
- Params: serviceId
- Returns: diagnosis + suggested fixes

### 10c: `find-similar-links`
- Use a search API to find pages similar to a given URL
- Params: url
- Returns: list of similar pages with titles and URLs

### 10d: `image-search`
- Search for images on the web
- Use Brave Image Search API, Google Custom Search, or SerpAPI
- Params: query, count
- Returns: image URLs with titles/sources

### 10e: `edit-file-llm`
- Fast file editing using an LLM (vs precise string replacement)
- Sends current file content + edit instruction to LLM
- LLM returns the full updated file
- Params: filePath, instruction
- Faster for broad changes; existing `edit-file` is better for precise edits

### 10f: `change-hardware`
- For self-hosted: informational only (shows current CPU/RAM/disk)
- For managed deployment: could actually resize server
- Params: cpu?, ram?, gpu?
- Returns: current/new hardware config

### 10g: `set-active-persona`
- Set the active persona for a specific channel
- Params: personaId, channel (chat/telegram/email/discord/sms)
- Updates the per-channel persona setting

### 10h: `update-user-settings`
- Update user name, bio, and other profile settings via AI tool
- Params: name?, bio?
- Returns: updated settings

## Step 11: Add Custom Domains Support

### Database
```typescript
custom_domains: {
  id: uuid primaryKey
  userId: uuid references users
  domain: text not null unique
  targetType: enum('site', 'space', 'service')
  targetId: uuid                // reference to site, space settings, or service
  verified: boolean default false
  verificationToken: text       // DNS TXT record for verification
  sslStatus: enum('pending', 'active', 'error')
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Backend
- `POST /api/domains` — add custom domain (generates verification token)
- `GET /api/domains` — list user's domains
- `POST /api/domains/:id/verify` — check DNS TXT record
- `DELETE /api/domains/:id` — remove domain
- Caddy integration: generate/update Caddyfile entries for verified domains
- Auto-HTTPS via Caddy's built-in ACME

### Frontend
- Domain management in Settings → Advanced or per-site settings
- Add domain → shows DNS instructions (CNAME + TXT records)
- Verify button → checks DNS propagation
- Status indicators (pending/verified/SSL active)

## Step 12: Terminology Alignment (Automations → Agents)

Rename throughout codebase:
- DB table: `automations` → `agents` (or add alias)
- API routes: `/api/automations` → `/api/agents`
- Tool names: `create-automation` → `create-agent`, `edit-automation` → `edit-agent`, etc.
- Frontend: all UI labels, page titles, nav items
- Variable names in code
- Documentation references

This is a broad rename but straightforward. Use find-and-replace with case sensitivity.

## Step 13: Skills Filesystem Alignment

Ensure skills work filesystem-first:
- Skills live at `workspace/Skills/<skill-name>/SKILL.md`
- `create-skill` tool creates the directory + SKILL.md file on disk
- Hub "install" downloads to `workspace/Skills/` directory
- Uninstall removes from filesystem
- Progressive loading reads from filesystem, not DB
- DB `skills` table is a cache/index of what's installed (syncs from filesystem)
- Full AgentSkills spec compliance (agentskills.io):
  - Frontmatter: name, description, compatibility, metadata, allowed-tools
  - Optional: scripts/, references/, assets/ subdirectories

## Build Verification
After all changes:
- [ ] `packages/web` builds clean
- [ ] `packages/core` builds clean
- [ ] No TypeScript errors
- [ ] Docker Compose still works
- [ ] MCP endpoint responds to `tools/list`
- [ ] Chat streaming works with AI SDK v6

## Commit
Single commit: "Remediation 2/2: MCP rewrite, Stagehand browser, missing tools, custom domains, agents terminology, skills alignment"
