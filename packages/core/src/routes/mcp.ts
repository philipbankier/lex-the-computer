// MCP (Model Context Protocol) Server — Official SDK implementation
// Uses @modelcontextprotocol/sdk with StreamableHTTPServerTransport
// Spec: https://modelcontextprotocol.io (2025-11-25 stable)

import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import { env } from '../lib/env.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';

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
import { createAgentTool } from '../tools/create_automation.js';
import { editAgentTool } from '../tools/edit_automation.js';
import { deleteAgentTool } from '../tools/delete_automation.js';
import { listAgentsTool } from '../tools/list_automations.js';
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
import {
  proxyLocalServiceTool, serviceDoctorTool, findSimilarLinksTool, imageSearchTool,
  editFileLlmTool, changeHardwareTool, setActivePersonaTool, updateUserSettingsTool,
} from '../tools/extra_tools.js';
import type { ToolDefinition } from '../tools/types.js';

export const mcpRouter = new Hono();

// All tools registry
const allTools: ToolDefinition[] = [
  webSearch, readWebpage, saveWebpage,
  createFile, editFile, listFilesTool, searchFilesTool,
  runCommand, runSequentialCommands, runParallelCommands,
  createAgentTool, editAgentTool, deleteAgentTool, listAgentsTool,
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
  // Step 10: New tools
  proxyLocalServiceTool, serviceDoctorTool, findSimilarLinksTool, imageSearchTool,
  editFileLlmTool, changeHardwareTool, setActivePersonaTool, updateUserSettingsTool,
];

// API key auth
async function validateApiKey(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const db = await getDb();
  const keys = await db.select().from(schema.api_keys).limit(100);
  for (const k of keys) {
    if (!k.is_active) continue;
    if (token.startsWith(k.key_prefix)) {
      await db.update(schema.api_keys).set({ last_used_at: new Date() } as any).where(eq(schema.api_keys.id, k.id));
      return true;
    }
  }
  return false;
}

// Lazy-load the MCP SDK to avoid hard dependency failures
let _mcpSdk: any = null;
async function getMcpSdk() {
  if (_mcpSdk) return _mcpSdk;
  try {
    const serverMod = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const transportMod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    _mcpSdk = { McpServer: serverMod.McpServer, StreamableHTTPServerTransport: transportMod.StreamableHTTPServerTransport };
    return _mcpSdk;
  } catch {
    return null;
  }
}

// Lazy-load zod for MCP tool schema definitions
let _z: any = null;
async function getZod() {
  if (_z) return _z;
  const mod: any = await import('zod');
  _z = mod.z || mod.default?.z || mod.default || mod;
  return _z;
}

// Build a Zod schema from JSON Schema parameters (simplified)
function jsonSchemaToZodShape(z: any, params: any): Record<string, any> {
  if (!params?.properties) return {};
  const shape: Record<string, any> = {};
  const required = new Set(params.required || []);
  for (const [key, prop] of Object.entries(params.properties) as any[]) {
    let field: any;
    switch (prop.type) {
      case 'number':
      case 'integer':
        field = z.number().describe(prop.description || '');
        break;
      case 'boolean':
        field = z.boolean().describe(prop.description || '');
        break;
      case 'array':
        field = z.array(z.any()).describe(prop.description || '');
        break;
      case 'object':
        field = z.record(z.any()).describe(prop.description || '');
        break;
      default:
        field = z.string().describe(prop.description || '');
        if (prop.enum) field = z.enum(prop.enum).describe(prop.description || '');
    }
    shape[key] = required.has(key) ? field : field.optional();
  }
  return shape;
}

// Create and configure the MCP server instance
async function createMcpServerInstance() {
  const sdk = await getMcpSdk();
  const z = await getZod();
  if (!sdk || !z) return null;

  const server = new sdk.McpServer({
    name: 'lex',
    version: '1.0.0',
  });

  // Register all tools
  for (const tool of allTools) {
    const shape = jsonSchemaToZodShape(z, tool.parameters);
    server.tool(
      tool.name,
      tool.description || '',
      shape,
      async (args: any) => {
        try {
          const result = await tool.execute(args);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
        }
      }
    );
  }

  // Register resources
  server.resource(
    'workspace-files',
    'lex://files/{filename}',
    async (uri: any) => {
      const filename = String(uri).replace('lex://files/', '');
      const filePath = path.join(env.WORKSPACE_DIR, 'files', filename);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { contents: [{ uri: String(uri), mimeType: 'text/plain', text: content.slice(0, 50000) }] };
      } catch {
        return { contents: [{ uri: String(uri), mimeType: 'text/plain', text: 'File not found' }] };
      }
    }
  );

  return server;
}

// Session map for persistent connections
const sessions = new Map<string, any>();

// POST /mcp — Streamable HTTP endpoint (primary)
mcpRouter.post('/', async (c) => {
  const auth = c.req.header('Authorization');
  if (!(await validateApiKey(auth))) {
    return c.json({ error: 'Unauthorized. Provide API key in Authorization: Bearer header.' }, 401);
  }

  const sdk = await getMcpSdk();
  if (!sdk) {
    // Fallback: if SDK not installed, use built-in JSON-RPC handler
    return handleFallbackRpc(c);
  }

  const body = await c.req.text();
  const sessionId = c.req.header('mcp-session-id');

  // Get or create session
  let transport = sessionId ? sessions.get(sessionId) : null;
  if (!transport) {
    const server = await createMcpServerInstance();
    if (!server) return handleFallbackRpc(c);

    transport = new sdk.StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    await server.connect(transport);

    // Store session after first request establishes it
    transport._onSessionId = (id: string) => {
      sessions.set(id, transport);
      // Clean up after 1 hour
      setTimeout(() => sessions.delete(id), 3600000);
    };
  }

  // Bridge Hono request to transport
  try {
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });

    const req = {
      method: 'POST',
      headers,
      body,
      url: c.req.url,
    };

    // Use transport.handleRequest for streamable HTTP
    const result = await transport.handleRequest(req);

    if (result.headers?.['mcp-session-id'] && !sessionId) {
      const newId = result.headers['mcp-session-id'];
      sessions.set(newId, transport);
      setTimeout(() => sessions.delete(newId), 3600000);
    }

    const responseHeaders: Record<string, string> = {};
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        responseHeaders[k] = String(v);
      }
    }

    return new Response(result.body ?? JSON.stringify(result.jsonBody), {
      status: result.statusCode || 200,
      headers: { 'Content-Type': 'application/json', ...responseHeaders },
    });
  } catch (e: any) {
    // If transport bridge fails, use fallback
    return handleFallbackRpc(c);
  }
});

// GET /mcp — SSE endpoint for streaming (backwards compat)
mcpRouter.get('/', async (c) => {
  const auth = c.req.header('Authorization');
  if (!(await validateApiKey(auth))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const sdk = await getMcpSdk();
  if (!sdk) {
    return c.json({ error: 'MCP SDK not installed. Run: npm install @modelcontextprotocol/sdk' }, 500);
  }

  const sessionId = c.req.header('mcp-session-id');
  const transport = sessionId ? sessions.get(sessionId) : null;

  if (!transport) {
    return c.json({ error: 'No active session. Send a POST request first to initialize.' }, 400);
  }

  // SSE streaming for notifications
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });

  const req = { method: 'GET', headers, url: c.req.url };

  try {
    const result = await transport.handleRequest(req);
    const responseHeaders: Record<string, string> = { 'Content-Type': 'text/event-stream' };
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        responseHeaders[k] = String(v);
      }
    }
    return new Response(result.body, { status: result.statusCode || 200, headers: responseHeaders });
  } catch {
    return c.json({ error: 'SSE connection failed' }, 500);
  }
});

// DELETE /mcp — Close session
mcpRouter.delete('/', async (c) => {
  const sessionId = c.req.header('mcp-session-id');
  if (sessionId) {
    const transport = sessions.get(sessionId);
    if (transport) {
      try { await transport.close(); } catch {}
      sessions.delete(sessionId);
    }
  }
  return c.json({ ok: true });
});

// ============================================
// Fallback JSON-RPC handler (no SDK required)
// ============================================

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

async function handleRpcRequest(body: any): Promise<any> {
  const { id, method, params } = body;

  switch (method) {
    case 'initialize': {
      return jsonRpcResponse(id, {
        protocolVersion: '2025-11-25',
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: { name: 'lex', version: '1.0.0' },
      });
    }
    case 'initialized': return null;
    case 'tools/list': {
      return jsonRpcResponse(id, { tools: allTools.map(toolToMcpSchema) });
    }
    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const tool = allTools.find(t => t.name === toolName);
      if (!tool) return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`);
      try {
        const result = await tool.execute(toolArgs);
        return jsonRpcResponse(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (e: any) {
        return jsonRpcResponse(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }
    case 'resources/list': {
      const resources: any[] = [];
      try {
        const filesDir = path.join(env.WORKSPACE_DIR, 'files');
        const files = await fs.readdir(filesDir).catch(() => []);
        for (const f of files.slice(0, 50)) {
          resources.push({ uri: `lex://files/${f}`, name: f, mimeType: 'text/plain' });
        }
      } catch {}
      try {
        const db = await getDb();
        const convos = await db.select().from(schema.conversations).limit(20);
        for (const c of convos) {
          resources.push({ uri: `lex://conversations/${c.id}`, name: c.title || `Conversation ${c.id}`, mimeType: 'application/json' });
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
          return jsonRpcResponse(id, { contents: [{ uri, mimeType: 'text/plain', text: content.slice(0, 50000) }] });
        } catch {
          return jsonRpcError(id, -32602, `File not found: ${filename}`);
        }
      }
      if (uri.startsWith('lex://conversations/')) {
        const convoId = Number(uri.replace('lex://conversations/', ''));
        const db = await getDb();
        const msgs = await db.select().from(schema.messages).where(eq(schema.messages.conversation_id, convoId)).limit(100);
        return jsonRpcResponse(id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(msgs, null, 2) }] });
      }
      return jsonRpcError(id, -32602, `Unknown resource URI: ${uri}`);
    }
    case 'ping': return jsonRpcResponse(id, {});
    default: return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

async function handleFallbackRpc(c: any) {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json(jsonRpcError(null, -32700, 'Parse error'), 400);

  if (Array.isArray(body)) {
    const results = await Promise.all(body.map(handleRpcRequest));
    return c.json(results.filter((r: any) => r !== null));
  }

  const result = await handleRpcRequest(body);
  if (result === null) return c.body(null, 204);
  return c.json(result);
}
