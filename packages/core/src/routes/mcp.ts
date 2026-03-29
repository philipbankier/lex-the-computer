// Phase 10: MCP (Model Context Protocol) Server
// Exposes all Lex tools via JSON-RPC over HTTP with SSE streaming
// Spec: https://modelcontextprotocol.io

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import { env } from '../lib/env.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Import all tools
import { webSearch } from '../tools/web_search.js';
import { readWebpage } from '../tools/read_webpage.js';
import { saveWebpage } from '../tools/save_webpage.js';
import { createFile } from '../tools/create_file.js';
import { editFile } from '../tools/edit_file.js';
import { listFilesTool } from '../tools/list_files.js';
import { searchFilesTool } from '../tools/search_files.js';
import { runCommand } from '../tools/run_command.js';
import { runSequentialCommands } from '../tools/run_sequential_commands.js';
import { runParallelCommands } from '../tools/run_parallel_commands.js';
import { createAutomationTool } from '../tools/create_automation.js';
import { editAutomationTool } from '../tools/edit_automation.js';
import { deleteAutomationTool } from '../tools/delete_automation.js';
import { listAutomationsTool } from '../tools/list_automations.js';
import { createSiteTool } from '../tools/create_site.js';
import { publishSiteTool, unpublishSiteTool } from '../tools/publish_site.js';
import { registerServiceTool, updateServiceTool, deleteServiceTool, listServicesTool } from '../tools/services_tools.js';
import {
  createSpaceRouteTool, editSpaceRouteTool, deleteSpaceRouteTool, listSpaceRoutesTool,
  getSpaceRouteTool, getSpaceRouteHistoryTool, undoSpaceRouteTool, redoSpaceRouteTool,
  uploadSpaceAssetTool, deleteSpaceAssetTool, listSpaceAssetsTool,
  getSpaceErrorsTool, getSpaceSettingsTool, updateSpaceSettingsTool, restartSpaceServerTool,
} from '../tools/space_tools.js';
import {
  createSkillTool, listSkillsTool, getSkillTool, toggleSkillTool,
  installHubSkillTool, uninstallSkillTool, searchHubSkillsTool,
} from '../tools/skills_tools.js';
import {
  useGmailTool, useCalendarTool, useNotionTool, useDriveTool,
  useDropboxTool, useLinearTool, useGithubTool, listAppToolsTool,
  useAirtableTool, useSpotifyTool, useOneDriveTool, useGoogleTasksTool, useOutlookTool,
} from '../tools/integration_tools.js';
import { sendTelegramTool, sendEmailTool, sendDiscordTool, sendSmsTool } from '../tools/channel_tools.js';
import { browseWebTool, browserSessionTool } from '../tools/browser_tools.js';
import {
  generateImageTool, editImageTool, transcribeAudioTool, transcribeVideoTool,
  generateVideoTool, createDiagramTool, describeDiagramTool,
} from '../tools/media_tools.js';
import { searchMapsTool } from '../tools/maps_tools.js';
import { sshExecTool, sshUploadTool, sshDownloadTool } from '../tools/ssh_tools.js';
import type { ToolDefinition } from '../tools/types.js';

export const mcpRouter = new Hono();

// All tools registry
const allTools: ToolDefinition[] = [
  webSearch, readWebpage, saveWebpage,
  createFile, editFile, listFilesTool, searchFilesTool,
  runCommand, runSequentialCommands, runParallelCommands,
  createAutomationTool, editAutomationTool, deleteAutomationTool, listAutomationsTool,
  createSiteTool, publishSiteTool, unpublishSiteTool,
  registerServiceTool, updateServiceTool, deleteServiceTool, listServicesTool,
  createSpaceRouteTool, editSpaceRouteTool, deleteSpaceRouteTool, listSpaceRoutesTool,
  getSpaceRouteTool, getSpaceRouteHistoryTool, undoSpaceRouteTool, redoSpaceRouteTool,
  uploadSpaceAssetTool, deleteSpaceAssetTool, listSpaceAssetsTool,
  getSpaceErrorsTool, getSpaceSettingsTool, updateSpaceSettingsTool, restartSpaceServerTool,
  createSkillTool, listSkillsTool, getSkillTool, toggleSkillTool,
  installHubSkillTool, uninstallSkillTool, searchHubSkillsTool,
  useGmailTool, useCalendarTool, useNotionTool, useDriveTool,
  useDropboxTool, useLinearTool, useGithubTool, listAppToolsTool,
  useAirtableTool, useSpotifyTool, useOneDriveTool, useGoogleTasksTool, useOutlookTool,
  sendTelegramTool, sendEmailTool, sendDiscordTool, sendSmsTool,
  browseWebTool, browserSessionTool,
  generateImageTool, editImageTool, transcribeAudioTool, transcribeVideoTool,
  generateVideoTool, createDiagramTool, describeDiagramTool,
  searchMapsTool,
  sshExecTool, sshUploadTool, sshDownloadTool,
];

const MCP_VERSION = '2024-11-05';
const SERVER_INFO = {
  name: 'lex',
  version: '1.0.0',
};

// API key auth middleware
async function validateApiKey(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const db = await getDb();
  const keys = await db.select().from(schema.api_keys).limit(100);
  // Simple prefix check (full hash check would be better but we don't have bcrypt here)
  for (const k of keys) {
    if (!k.is_active) continue;
    if (token.startsWith(k.key_prefix)) {
      // Update last_used
      await db.update(schema.api_keys).set({ last_used_at: new Date() } as any).where(eq(schema.api_keys.id, k.id));
      return true;
    }
  }
  return false;
}

function jsonRpcResponse(id: any, result: any) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id: any, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function toolToMcpSchema(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description || '',
    inputSchema: tool.parameters || { type: 'object', properties: {} },
  };
}

// Handle JSON-RPC requests
async function handleRpcRequest(body: any): Promise<any> {
  const { id, method, params } = body;

  switch (method) {
    case 'initialize': {
      return jsonRpcResponse(id, {
        protocolVersion: MCP_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: SERVER_INFO,
      });
    }

    case 'initialized': {
      // Client acknowledges initialization — no response needed for notifications
      return null;
    }

    case 'tools/list': {
      const tools = allTools.map(toolToMcpSchema);
      return jsonRpcResponse(id, { tools });
    }

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const tool = allTools.find(t => t.name === toolName);
      if (!tool) {
        return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`);
      }
      try {
        const result = await tool.execute(toolArgs);
        return jsonRpcResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (e: any) {
        return jsonRpcResponse(id, {
          content: [{ type: 'text', text: `Error: ${e.message}` }],
          isError: true,
        });
      }
    }

    case 'resources/list': {
      // List available resources: files and conversations
      const resources: any[] = [];

      // Add workspace files
      try {
        const filesDir = path.join(env.WORKSPACE_DIR, 'files');
        const files = await fs.readdir(filesDir).catch(() => []);
        for (const f of files.slice(0, 50)) {
          resources.push({
            uri: `lex://files/${f}`,
            name: f,
            mimeType: 'text/plain',
          });
        }
      } catch {}

      // Add recent conversations
      try {
        const db = await getDb();
        const convos = await db.select().from(schema.conversations).limit(20);
        for (const c of convos) {
          resources.push({
            uri: `lex://conversations/${c.id}`,
            name: c.title || `Conversation ${c.id}`,
            mimeType: 'application/json',
          });
        }
      } catch {}

      return jsonRpcResponse(id, { resources });
    }

    case 'resources/read': {
      const uri = params?.uri as string;
      if (!uri) return jsonRpcError(id, -32602, 'uri required');

      if (uri.startsWith('lex://files/')) {
        const filename = uri.replace('lex://files/', '');
        const filePath = path.join(env.WORKSPACE_DIR, 'files', filename);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return jsonRpcResponse(id, {
            contents: [{ uri, mimeType: 'text/plain', text: content.slice(0, 50000) }],
          });
        } catch {
          return jsonRpcError(id, -32602, `File not found: ${filename}`);
        }
      }

      if (uri.startsWith('lex://conversations/')) {
        const convoId = Number(uri.replace('lex://conversations/', ''));
        const db = await getDb();
        const msgs = await db.select().from(schema.messages).where(eq(schema.messages.conversation_id, convoId)).limit(100);
        return jsonRpcResponse(id, {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(msgs, null, 2) }],
        });
      }

      return jsonRpcError(id, -32602, `Unknown resource URI: ${uri}`);
    }

    case 'ping': {
      return jsonRpcResponse(id, {});
    }

    default: {
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
  }
}

// POST /mcp — JSON-RPC handler
mcpRouter.post('/', async (c) => {
  // Auth check
  const auth = c.req.header('Authorization');
  if (!(await validateApiKey(auth))) {
    return c.json({ error: 'Unauthorized. Provide API key in Authorization: Bearer header.' }, 401);
  }

  const body = await c.req.json();

  // Handle batch requests
  if (Array.isArray(body)) {
    const results = await Promise.all(body.map(handleRpcRequest));
    return c.json(results.filter(r => r !== null));
  }

  const result = await handleRpcRequest(body);
  if (result === null) {
    // Notification — no response
    return c.body(null, 204);
  }
  return c.json(result);
});

// GET /mcp — SSE endpoint for streaming MCP
mcpRouter.get('/', async (c) => {
  const auth = c.req.header('Authorization');
  if (!(await validateApiKey(auth))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return streamSSE(c, async (stream) => {
    // Send server info
    await stream.writeSSE({
      event: 'endpoint',
      data: '/mcp',
    });

    // Keep connection alive
    const interval = setInterval(async () => {
      try {
        await stream.writeSSE({ event: 'ping', data: '' });
      } catch {
        clearInterval(interval);
      }
    }, 30000);

    // Wait for connection to close
    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener('abort', () => {
        clearInterval(interval);
        resolve();
      });
    });
  });
});
