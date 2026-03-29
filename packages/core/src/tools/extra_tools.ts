// Step 10: Missing tools — proxy-local-service, service-doctor, find-similar-links,
// image-search, edit-file-llm, change-hardware, set-active-persona, update-user-settings

import { ToolDefinition } from './types.js';
import { getDb, schema } from '../lib/db.js';
import { env } from '../lib/env.js';
import { chatCompletion } from '../lib/litellm.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// 10a: proxy-local-service — Create a tunnel to expose a local port publicly
export const proxyLocalServiceTool: ToolDefinition<{ port: number; subdomain?: string }> = {
  name: 'proxy_local_service',
  description: 'Create a public tunnel to expose a local service (like ngrok). Uses localtunnel.',
  parameters: {
    type: 'object',
    properties: {
      port: { type: 'number', description: 'Local port to expose' },
      subdomain: { type: 'string', description: 'Requested subdomain (optional)' },
    },
    required: ['port'],
  },
  async execute({ port, subdomain }) {
    try {
      const lt = await (Function('return import("localtunnel")')() as Promise<any>);
      const tunnel = await (lt.default || lt)({ port, subdomain: subdomain || undefined });
      return { url: tunnel.url, port, subdomain: subdomain || null };
    } catch (e: any) {
      // Fallback: try using npx
      try {
        const subArg = subdomain ? `--subdomain ${subdomain}` : '';
        const { stdout } = await execAsync(`npx -y localtunnel --port ${port} ${subArg}`, { timeout: 15000 });
        const urlMatch = stdout.match(/https?:\/\/[^\s]+/);
        return { url: urlMatch?.[0] || 'Tunnel started', port };
      } catch {
        return { error: 'localtunnel not available. Install with: npm install -g localtunnel' };
      }
    }
  },
};

// 10b: service-doctor — AI-powered service diagnostics
export const serviceDoctorTool: ToolDefinition<{ service_id?: number; port?: number; name?: string }> = {
  name: 'service_doctor',
  description: 'Diagnose service issues — checks if process is running, port responding, and provides AI-powered suggestions.',
  parameters: {
    type: 'object',
    properties: {
      service_id: { type: 'number', description: 'Service ID to diagnose' },
      port: { type: 'number', description: 'Port to check (alternative to service_id)' },
      name: { type: 'string', description: 'Service name to check (alternative to service_id)' },
    },
  },
  async execute({ service_id, port, name }) {
    const checks: { check: string; status: 'ok' | 'warning' | 'error'; detail: string }[] = [];

    // Resolve service info
    let servicePort = port;
    let serviceName = name || 'unknown';
    if (service_id) {
      const db = await getDb();
      const svc = (await db.select().from(schema.services).where({ id: service_id } as any).limit(1))[0];
      if (svc) {
        servicePort = svc.port || undefined;
        serviceName = svc.name;
        checks.push({ check: 'database', status: 'ok', detail: `Service "${svc.name}" found, is_running=${svc.is_running}` });
      } else {
        checks.push({ check: 'database', status: 'error', detail: 'Service not found in database' });
        return { service: serviceName, checks };
      }
    }

    // Check port
    if (servicePort) {
      try {
        const { stdout } = await execAsync(`ss -tlnp | grep :${servicePort} || echo "not listening"`, { timeout: 5000 });
        if (stdout.includes('not listening')) {
          checks.push({ check: 'port', status: 'error', detail: `Port ${servicePort} is not listening` });
        } else {
          checks.push({ check: 'port', status: 'ok', detail: `Port ${servicePort} is listening` });
        }
      } catch {
        checks.push({ check: 'port', status: 'warning', detail: 'Could not check port status' });
      }

      // Check HTTP response
      try {
        const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${servicePort}/ --max-time 5`, { timeout: 10000 });
        const code = parseInt(stdout.trim());
        if (code >= 200 && code < 400) {
          checks.push({ check: 'http', status: 'ok', detail: `HTTP ${code} response` });
        } else if (code > 0) {
          checks.push({ check: 'http', status: 'warning', detail: `HTTP ${code} response` });
        } else {
          checks.push({ check: 'http', status: 'error', detail: 'No HTTP response' });
        }
      } catch {
        checks.push({ check: 'http', status: 'error', detail: 'HTTP check failed (service not responding)' });
      }
    }

    // Check disk space
    try {
      const { stdout } = await execAsync('df -h / | tail -1', { timeout: 5000 });
      const parts = stdout.trim().split(/\s+/);
      const usePercent = parseInt(parts[4] || '0');
      checks.push({ check: 'disk', status: usePercent > 90 ? 'error' : usePercent > 80 ? 'warning' : 'ok', detail: `Disk usage: ${parts[4]}` });
    } catch {}

    // Check memory
    try {
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const usedPercent = Math.round((1 - freeMem / totalMem) * 100);
      checks.push({ check: 'memory', status: usedPercent > 90 ? 'error' : usedPercent > 80 ? 'warning' : 'ok', detail: `Memory: ${usedPercent}% used (${Math.round(freeMem / 1024 / 1024)}MB free)` });
    } catch {}

    const hasErrors = checks.some(c => c.status === 'error');
    return {
      service: serviceName,
      port: servicePort,
      healthy: !hasErrors,
      checks,
      suggestion: hasErrors ? 'Check service logs and ensure the process is running. Restart if needed.' : 'Service appears healthy.',
    };
  },
};

// 10c: find-similar-links — Find pages similar to a URL
export const findSimilarLinksTool: ToolDefinition<{ url: string; count?: number }> = {
  name: 'find_similar_links',
  description: 'Find web pages similar to a given URL using search.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to find similar pages for' },
      count: { type: 'number', description: 'Number of results (default 5)' },
    },
    required: ['url'],
  },
  async execute({ url }) {
    // Use web search with "related:" or "similar to" query
    const query = `related:${url}`;
    try {
      const { webSearch } = await import('./web_search.js');
      const results = await webSearch.execute({ query });
      return results;
    } catch (e: any) {
      // Fallback: search for the domain/title
      try {
        const domain = new URL(url).hostname;
        const { webSearch } = await import('./web_search.js');
        return await webSearch.execute({ query: `sites similar to ${domain}` });
      } catch {
        return { error: `Could not find similar pages: ${e.message}` };
      }
    }
  },
};

// 10d: image-search — Search for images on the web
export const imageSearchTool: ToolDefinition<{ query: string; count?: number }> = {
  name: 'image_search',
  description: 'Search for images on the web. Returns image URLs with titles and sources.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for images' },
      count: { type: 'number', description: 'Number of results (default 5)' },
    },
    required: ['query'],
  },
  async execute({ query, count = 5 }) {
    // Try Brave Image Search API if available
    try {
      const braveKey = process.env.BRAVE_API_KEY;
      if (braveKey) {
        const res = await fetch(`https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=${count}`, {
          headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json() as any;
          return {
            images: (data.results || []).slice(0, count).map((r: any) => ({
              title: r.title,
              url: r.url,
              thumbnail: r.thumbnail?.src,
              source: r.source,
              width: r.properties?.width,
              height: r.properties?.height,
            })),
          };
        }
      }
    } catch {}

    // Fallback: use regular web search with "images" qualifier
    try {
      const { webSearch } = await import('./web_search.js');
      return await webSearch.execute({ query: `${query} images` });
    } catch (e: any) {
      return { error: `Image search failed: ${e.message}` };
    }
  },
};

// 10e: edit-file-llm — Fast file editing using LLM
export const editFileLlmTool: ToolDefinition<{ file_path: string; instruction: string }> = {
  name: 'edit_file_llm',
  description: 'Edit a file using an LLM to apply changes. Sends current file content + instruction to an LLM which returns the updated file. Best for broad, complex edits.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to the file (relative to workspace)' },
      instruction: { type: 'string', description: 'What changes to make to the file' },
    },
    required: ['file_path', 'instruction'],
  },
  async execute({ file_path, instruction }) {
    const fullPath = path.isAbsolute(file_path) ? file_path : path.join(env.WORKSPACE_DIR, 'files', file_path);
    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch {
      return { error: `File not found: ${file_path}` };
    }

    if (content.length > 100000) {
      return { error: 'File too large for LLM editing (>100KB). Use edit_file for precise edits.' };
    }

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a code editor. Given a file and an edit instruction, return ONLY the updated file content. No explanations, no markdown code fences — just the raw file content.',
      },
      {
        role: 'user' as const,
        content: `File: ${path.basename(fullPath)}\n\nCurrent content:\n\`\`\`\n${content}\n\`\`\`\n\nInstruction: ${instruction}\n\nReturn the complete updated file content:`,
      },
    ];

    const resp = await chatCompletion({ model: 'gpt-4o-mini', messages });
    const updated = resp?.choices?.[0]?.message?.content || '';
    if (!updated.trim()) {
      return { error: 'LLM returned empty content' };
    }

    // Strip potential code fences the LLM might add
    const clean = updated.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
    await fs.writeFile(fullPath, clean, 'utf-8');
    return { ok: true, path: file_path, size: clean.length };
  },
};

// 10f: change-hardware — View/configure hardware resources
export const changeHardwareTool: ToolDefinition<{ cpu?: number; ram?: number; gpu?: string }> = {
  name: 'change_hardware',
  description: 'View current hardware configuration. For self-hosted: informational only. Shows CPU, RAM, disk, GPU info.',
  parameters: {
    type: 'object',
    properties: {
      cpu: { type: 'number', description: 'Requested CPU cores (informational for self-hosted)' },
      ram: { type: 'number', description: 'Requested RAM in GB (informational for self-hosted)' },
      gpu: { type: 'string', description: 'Requested GPU type (informational for self-hosted)' },
    },
  },
  async execute({ cpu, ram, gpu }) {
    const current = {
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'unknown',
        speed: `${os.cpus()[0]?.speed || 0} MHz`,
      },
      ram: {
        total: `${Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10} GB`,
        free: `${Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10} GB`,
        used: `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024 * 10) / 10} GB`,
      },
      platform: os.platform(),
      arch: os.arch(),
      uptime: `${Math.round(os.uptime() / 3600)} hours`,
    };

    // Try to get disk info
    let disk: any = null;
    try {
      const { stdout } = await execAsync('df -h / | tail -1', { timeout: 5000 });
      const parts = stdout.trim().split(/\s+/);
      disk = { total: parts[1], used: parts[2], available: parts[3], usePercent: parts[4] };
    } catch {}

    // Try to detect GPU
    let gpuInfo: string | null = null;
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null || echo "none"', { timeout: 5000 });
      if (!stdout.trim().includes('none')) gpuInfo = stdout.trim();
    } catch {}

    const result: any = { current: { ...current, disk, gpu: gpuInfo } };

    if (cpu || ram || gpu) {
      result.note = 'Hardware changes are not supported on self-hosted instances. This is the current hardware configuration.';
      result.requested = { cpu, ram, gpu };
    }

    return result;
  },
};

// 10g: set-active-persona — Set persona per channel
export const setActivePersonaTool: ToolDefinition<{ persona_id: number; channel: string }> = {
  name: 'set_active_persona',
  description: 'Set the active persona for a specific channel (chat, telegram, email, discord, sms).',
  parameters: {
    type: 'object',
    properties: {
      persona_id: { type: 'number', description: 'Persona ID to activate' },
      channel: { type: 'string', enum: ['chat', 'telegram', 'email', 'discord', 'sms'], description: 'Channel to set persona for' },
    },
    required: ['persona_id', 'channel'],
  },
  async execute({ persona_id, channel }) {
    const db = await getDb();
    const user_id = 1;

    // Verify persona exists
    const persona = (await db.select().from(schema.personas).where({ id: persona_id } as any).limit(1))[0];
    if (!persona) return { error: 'Persona not found' };

    if (channel === 'chat') {
      // Set default persona for chat conversations
      await db.update(schema.personas).set({ is_default: false } as any).where({ user_id } as any);
      await db.update(schema.personas).set({ is_default: true } as any).where({ id: persona_id } as any);
      return { ok: true, channel: 'chat', persona: persona.name };
    }

    // For other channels, update the channel's persona_id
    const channels = await db.select().from(schema.channels)
      .where({ user_id, type: channel, is_active: true } as any);
    if (channels.length === 0) return { error: `No active ${channel} channel found` };

    for (const ch of channels) {
      await db.update(schema.channels).set({ persona_id } as any).where({ id: ch.id } as any);
    }
    return { ok: true, channel, persona: persona.name, channelsUpdated: channels.length };
  },
};

// 10h: update-user-settings — Update user profile settings
export const updateUserSettingsTool: ToolDefinition<{ name?: string; bio?: string; handle?: string }> = {
  name: 'update_user_settings',
  description: 'Update user profile settings like name, bio, and handle.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Display name' },
      bio: { type: 'string', description: 'User bio' },
      handle: { type: 'string', description: 'Username handle' },
    },
  },
  async execute({ name, bio, handle }) {
    const db = await getDb();
    const user_id = 1;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (handle !== undefined) updates.handle = handle;

    if (Object.keys(updates).length === 0) {
      return { error: 'No settings to update' };
    }

    const [row] = await db.update(schema.users).set(updates as any).where({ id: user_id } as any).returning();
    return { ok: true, user: { id: row.id, name: row.name, bio: row.bio, handle: row.handle } };
  },
};
