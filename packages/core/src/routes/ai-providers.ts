// AI Providers route — manage Claude Code, Codex, Gemini CLI, BYOK, and built-in providers

import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq, and } from 'drizzle-orm';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execAsync = promisify(exec);

export const aiProvidersRouter = new Hono();
const userIdFromCtx = () => 1;

type ProviderType = 'builtin' | 'byok' | 'claude-code' | 'codex' | 'gemini-cli';

interface CLIProvider {
  type: ProviderType;
  name: string;
  binary: string;
  authPaths: string[]; // paths to check for auth tokens
  defaultModel: string;
}

const CLI_PROVIDERS: CLIProvider[] = [
  {
    type: 'claude-code',
    name: 'Claude Code',
    binary: 'claude',
    authPaths: [
      path.join(os.homedir(), '.claude', 'credentials.json'),
      path.join(os.homedir(), '.config', 'claude', 'credentials.json'),
    ],
    defaultModel: 'claude-sonnet-4-6',
  },
  {
    type: 'codex',
    name: 'Codex',
    binary: 'codex',
    authPaths: [
      path.join(os.homedir(), '.codex', 'auth.json'),
      path.join(os.homedir(), '.config', 'codex', 'auth.json'),
    ],
    defaultModel: 'codex',
  },
  {
    type: 'gemini-cli',
    name: 'Gemini CLI',
    binary: 'gemini',
    authPaths: [
      path.join(os.homedir(), '.gemini', 'credentials.json'),
      path.join(os.homedir(), '.config', 'gemini', 'credentials.json'),
    ],
    defaultModel: 'gemini-2.5-pro',
  },
];

async function isBinaryInstalled(binary: string): Promise<boolean> {
  try {
    await execAsync(`which ${binary}`);
    return true;
  } catch {
    return false;
  }
}

async function isAuthenticated(authPaths: string[]): Promise<boolean> {
  for (const p of authPaths) {
    try {
      await fs.access(p);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

// List all providers for user (with detection info for CLI providers)
aiProvidersRouter.get('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();

  const rows = await db.select().from(schema.ai_providers).where(eq(schema.ai_providers.user_id, user_id));

  return c.json(rows);
});

// Detect installed CLI providers
aiProvidersRouter.get('/detect', async (c) => {
  const results = await Promise.all(
    CLI_PROVIDERS.map(async (p) => {
      const installed = await isBinaryInstalled(p.binary);
      const authenticated = installed ? await isAuthenticated(p.authPaths) : false;
      return {
        type: p.type,
        name: p.name,
        binary: p.binary,
        installed,
        authenticated,
        defaultModel: p.defaultModel,
      };
    }),
  );
  return c.json(results);
});

// Enable/disable a provider or update config
aiProvidersRouter.put('/:id', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const id = Number(c.req.param('id'));
  const body = await c.req.json();

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (body.is_enabled !== undefined) updates.is_enabled = body.is_enabled;
  if (body.config !== undefined) updates.config = body.config;
  if (body.default_model !== undefined) updates.default_model = body.default_model;
  if (body.is_authenticated !== undefined) updates.is_authenticated = body.is_authenticated;

  await db.update(schema.ai_providers).set(updates as any).where(
    and(eq(schema.ai_providers.id, id), eq(schema.ai_providers.user_id, user_id)),
  );

  return c.json({ ok: true });
});

// Create a new provider entry
aiProvidersRouter.post('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json();

  const [row] = await db.insert(schema.ai_providers).values({
    user_id,
    type: body.type,
    name: body.name,
    is_enabled: body.is_enabled ?? false,
    is_authenticated: body.is_authenticated ?? false,
    config: body.config ?? null,
    default_model: body.default_model ?? null,
  }).returning();

  return c.json(row);
});

// Check auth status for a CLI provider
aiProvidersRouter.post('/:id/auth-status', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const id = Number(c.req.param('id'));

  const [provider] = await db.select().from(schema.ai_providers).where(
    and(eq(schema.ai_providers.id, id), eq(schema.ai_providers.user_id, user_id)),
  );
  if (!provider) return c.json({ error: 'Provider not found' }, 404);

  const cliProvider = CLI_PROVIDERS.find((p) => p.type === provider.type);
  if (!cliProvider) {
    return c.json({ authenticated: true }); // non-CLI providers don't need CLI auth check
  }

  const installed = await isBinaryInstalled(cliProvider.binary);
  const authenticated = installed ? await isAuthenticated(cliProvider.authPaths) : false;

  // Update DB
  await db.update(schema.ai_providers).set({
    is_authenticated: authenticated,
    updated_at: new Date(),
  } as any).where(eq(schema.ai_providers.id, id));

  return c.json({ installed, authenticated });
});

// Get available models for a provider
aiProvidersRouter.get('/:id/models', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const id = Number(c.req.param('id'));

  const [provider] = await db.select().from(schema.ai_providers).where(
    and(eq(schema.ai_providers.id, id), eq(schema.ai_providers.user_id, user_id)),
  );
  if (!provider) return c.json({ error: 'Provider not found' }, 404);

  // Return available models based on provider type
  const modelsByType: Record<string, { id: string; name: string }[]> = {
    'builtin': [
      { id: 'auto', name: 'Auto (LiteLLM routing)' },
    ],
    'claude-code': [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
    'codex': [
      { id: 'codex', name: 'Codex' },
      { id: 'o3', name: 'o3' },
      { id: 'o4-mini', name: 'o4-mini' },
    ],
    'gemini-cli': [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
    'byok': [
      { id: 'custom', name: 'Custom (via API key)' },
    ],
  };

  return c.json(modelsByType[provider.type] || []);
});

// Delete a provider
aiProvidersRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const id = Number(c.req.param('id'));

  await db.delete(schema.ai_providers).where(
    and(eq(schema.ai_providers.id, id), eq(schema.ai_providers.user_id, user_id)),
  );

  return c.json({ ok: true });
});
