# MCP Setup — Lex the Computer

Lex exposes all its tools via the [Model Context Protocol](https://modelcontextprotocol.io) (MCP) at `/mcp`.

## Prerequisites

1. Lex core server running (default: `http://localhost:3001`)
2. An API key created in **Settings > API Keys**

## Endpoint

```
POST http://localhost:3001/mcp
Authorization: Bearer lex_your_api_key
```

Transport: **Streamable HTTP** (MCP spec 2025-11-25). Falls back to built-in JSON-RPC if `@modelcontextprotocol/sdk` is not installed.

---

## Client Configuration

### Claude Code

```bash
claude mcp add --transport http lex http://localhost:3001/mcp \
  --header "Authorization: Bearer lex_your_api_key"
```

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lex": {
      "command": "npx",
      "args": [
        "mcp-remote@latest",
        "http://localhost:3001/mcp",
        "--header",
        "Authorization: Bearer lex_your_api_key"
      ]
    }
  }
}
```

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer lex_your_api_key"
      }
    }
  }
}
```

### Zed

Edit `settings.json`:

```json
{
  "context_servers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer lex_your_api_key"
      }
    }
  }
}
```

### OpenCode

Edit `opencode.json`:

```json
{
  "mcp": {
    "lex": {
      "type": "remote",
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer lex_your_api_key"
      }
    }
  }
}
```

### Gemini CLI

Edit `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer lex_your_api_key"
      }
    }
  }
}
```

---

## Available Tools

All Lex tools are exposed via MCP, including:

### Core
- `web_search`, `read_webpage`, `save_webpage` — Web search & scraping
- `find_similar_links` — Find pages similar to a URL
- `image_search` — Search for images on the web
- `create_file`, `edit_file`, `edit_file_llm`, `list_files`, `search_files` — File operations
- `run_command`, `run_sequential_commands`, `run_parallel_commands` — Shell commands

### Browser
- `browse_web` — Navigate, screenshot, click, type, extract, evaluate, AI interact (Stagehand)
- `browser_session` — Manage browser sessions

### Agents
- `create_agent`, `edit_agent`, `delete_agent`, `list_agents`

### Sites & Services
- `create_site`, `publish_site`, `unpublish_site`
- `register_service`, `update_service`, `delete_service`, `list_services`
- `proxy_local_service` — Expose local services publicly (like ngrok)
- `service_doctor` — AI-powered service diagnostics

### Space
- `create_space_route`, `edit_space_route`, `delete_space_route`, `list_space_routes`
- Asset, settings, error, and version management tools

### Skills
- `create_skill`, `list_skills`, `get_skill`, `toggle_skill`
- `install_hub_skill`, `uninstall_skill`, `search_hub_skills`

### Integrations
- `use_gmail`, `use_calendar`, `use_notion`, `use_drive`, `use_dropbox`
- `use_linear`, `use_github`, `use_airtable`, `use_spotify`
- `use_onedrive`, `use_google_tasks`, `use_outlook`
- `list_app_tools`

### Channels
- `send_telegram`, `send_email`, `send_discord`, `send_sms`

### Media
- `generate_image`, `edit_image` — fal.ai image generation/editing
- `generate_video` — fal.ai video generation
- `transcribe_audio`, `transcribe_video` — Groq Whisper transcription
- `create_diagram`, `describe_diagram` — D2 diagrams

### SSH
- `ssh_exec`, `ssh_upload`, `ssh_download`

### System
- `search_maps` — Google Maps search
- `change_hardware` — View/configure hardware resources
- `set_active_persona` — Set persona per channel
- `update_user_settings` — Update user profile via tool

## Resources

- `lex://files/{filename}` — Workspace files
- `lex://conversations/{id}` — Chat history

## Testing

```bash
# Initialize
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer lex_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{}}}'

# List tools
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer lex_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call a tool
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer lex_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_files","arguments":{}}}'
```
