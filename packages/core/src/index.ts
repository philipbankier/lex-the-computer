import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import fs from 'node:fs/promises';
import path from 'node:path';

import { chatRouter } from './routes/chat.js';
import { personasRouter } from './routes/personas.js';
import { rulesRouter } from './routes/rules.js';
import { profileRouter } from './routes/profile.js';
import { settingsRouter } from './routes/settings.js';
import { modelsRouter } from './routes/models.js';
import { filesRouter } from './routes/files.js';
import { env } from './lib/env.js';
import { terminalRouter } from './routes/terminal.js';
import { automationsRouter } from './routes/automations.js';

const app = new Hono();
app.use('*', cors());

app.get('/health', (c) => c.json({ ok: true }));

// Helper to return 501
const notImplemented = (c: Context) => c.json({ error: 'Not Implemented' }, 501);

// API namespace
app.post('/api/auth/signup', notImplemented);
app.post('/api/auth/login', notImplemented);
app.post('/api/auth/logout', notImplemented);
app.get('/api/auth/session', notImplemented);

// Phase 1 Chat APIs
app.route('/api/chat', chatRouter);
app.route('/api/personas', personasRouter);
app.route('/api/rules', rulesRouter);
app.route('/api/profile', profileRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/models', modelsRouter);
app.route('/api/files', filesRouter);
app.route('/api/terminal', terminalRouter);
app.route('/api/automations', automationsRouter);

app.get('/api/sites', notImplemented);
app.post('/api/sites', notImplemented);

app.get('/api/skills', notImplemented);
app.get('/api/skills/hub', notImplemented);

app.get('/api/settings', notImplemented);
app.put('/api/settings', notImplemented);

app.get('/api/system/stats', notImplemented);

async function ensureWorkspace() {
  const base = env.WORKSPACE_DIR;
  const subdirs = ['files', 'sites', 'skills', 'articles', '.config'];
  try {
    await fs.mkdir(base, { recursive: true });
    await Promise.all(subdirs.map((d) => fs.mkdir(path.join(base, d), { recursive: true })));
  } catch {
    // ignore
  }
}

const port = Number(process.env.CORE_PORT || 3001);
ensureWorkspace().finally(() => {
  console.log(`Core API listening on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
});
