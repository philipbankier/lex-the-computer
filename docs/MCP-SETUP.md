# MCP Server Setup Guide

Lex exposes all its tools via the [Model Context Protocol](https://modelcontextprotocol.io) (MCP). This allows external AI tools like Claude Code, Cursor, Gemini CLI, and others to use Lex's capabilities directly.

## Prerequisites

1. Lex is running (default: `http://localhost:3001`)
2. You have an API key (create one in Settings > Advanced > API Keys)

## Endpoint

- **URL**: `http://localhost:3001/mcp` (or `https://yourdomain.com/mcp` if deployed)
- **Auth**: API key in `Authorization: Bearer` header

## Configuration Examples

### Claude Code (`~/.claude.json`)

```json
{
  "mcpServers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer lex_your_api_key_here"
      }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "lex": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer lex_your_api_key_here"
      }
    }
  }
}
```

### Gemini CLI (`~/.gemini/settings.json`)

```json
{
  "mcpServers": {
    "lex": {
      "httpUrl": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer lex_your_api_key_here"
      }
    }
  }
}
```

### Zed (`settings.json`)

```json
{
  "context_servers": {
    "lex": {
      "settings": {
        "url": "http://localhost:3001/mcp",
        "headers": {
          "Authorization": "Bearer lex_your_api_key_here"
        }
      }
    }
  }
}
```

### OpenCode (`opencode.json`)

```json
{
  "mcp": {
    "lex": {
      "type": "http",
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer lex_your_api_key_here"
      }
    }
  }
}
```

## Available Tools

The MCP server exposes all Lex tools, including:

### Core Tools
- `web_search` — Search the web
- `read_webpage` — Read a webpage
- `save_webpage` — Save a webpage as markdown
- `create_file`, `edit_file`, `list_files`, `search_files` — File operations
- `run_command`, `run_sequential_commands`, `run_parallel_commands` — Shell commands

### Automations
- `create_automation`, `edit_automation`, `delete_automation`, `list_automations`

### Sites & Services
- `create_site`, `publish_site`, `unpublish_site`
- `register_service`, `update_service`, `delete_service`, `list_services`

### Space (Personal Domain)
- `create_space_route`, `edit_space_route`, `delete_space_route`, `list_space_routes`
- Asset and settings management tools

### Skills
- `create_skill`, `list_skills`, `install_hub_skill`, `uninstall_skill`

### Integrations
- `use_gmail`, `use_calendar`, `use_notion`, `use_drive`, `use_dropbox`, `use_linear`, `use_github`
- `use_airtable`, `use_spotify`, `use_onedrive`, `use_google_tasks`, `use_outlook`
- `list_app_tools` — List all connected integrations

### Channels
- `send_telegram`, `send_email`, `send_discord`, `send_sms`

### Browser (Phase 10)
- `browse_web` — Navigate, screenshot, click, type, extract, evaluate
- `browser_session` — Manage browser sessions

### Media (Phase 10)
- `generate_image` — Generate images (DALL-E, Stability AI, Replicate)
- `edit_image` — Edit images, remove backgrounds, upscale
- `transcribe_audio` — Transcribe audio files (Whisper)
- `transcribe_video` — Transcribe video files
- `generate_video` — Generate short video clips from images
- `create_diagram` — Generate diagrams from D2 code
- `describe_diagram` — Generate diagrams from natural language

### Maps
- `search_maps` — Search places, get details, get directions

### SSH
- `ssh_exec` — Execute commands on remote hosts
- `ssh_upload` — Upload files to remote hosts
- `ssh_download` — Download files from remote hosts

## Resources

The MCP server also exposes resources:

- `lex://files/{filename}` — Read workspace files
- `lex://conversations/{id}` — Read conversation history

## Testing

You can test the MCP endpoint with curl:

```bash
# Initialize
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer lex_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}'

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
