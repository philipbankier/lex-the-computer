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
import { sitesRouter } from './routes/sites.js';
import { servicesRouter } from './routes/services.js';
import { secretsRouter } from './routes/secrets.js';
import { terminalRouter } from './routes/terminal.js';
import { automationsRouter } from './routes/automations.js';
import { spaceRouter, spacePublicRouter } from './routes/space.js';
import { skillsRouter } from './routes/skills.js';
import { integrationsRouter } from './routes/integrations.js';
import { apiKeysRouter } from './routes/api-keys.js';
import { publicApiRouter } from './routes/public-api.js';
import { seedHubSkills } from './services/seed-hub-skills.js';
import { channelsRouter } from './routes/channels.js';
import { onboardingRouter } from './routes/onboarding.js';
import { datasetsRouter } from './routes/datasets.js';
import { systemRouter } from './routes/system.js';
import { notificationsRouter } from './routes/notifications.js';
import { searchRouter } from './routes/search.js';
import { registerAllChannels, initializeChannels } from './services/channels/index.js';

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
app.route('/api/sites', sitesRouter);
app.route('/api/services', servicesRouter);
app.route('/api/secrets', secretsRouter);
app.route('/api/space', spaceRouter);
app.route('/public/space', spacePublicRouter);
app.route('/space', spacePublicRouter);

app.route('/api/skills', skillsRouter);

// Phase 7: Integrations & API
app.route('/api/integrations', integrationsRouter);
app.route('/api/api-keys', apiKeysRouter);
app.route('/api/v1', publicApiRouter);

// Phase 8: Channels
app.route('/api/channels', channelsRouter);

// Phase 9: Onboarding & Polish
app.route('/api/onboarding', onboardingRouter);
app.route('/api/datasets', datasetsRouter);
app.route('/api/system', systemRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/search', searchRouter);

async function ensureWorkspace() {
  const base = env.WORKSPACE_DIR;
  const subdirs = ['files', 'sites', 'skills', 'articles', '.config', 'space-assets', 'datasets'];
  try {
    await fs.mkdir(base, { recursive: true });
    await Promise.all(subdirs.map((d) => fs.mkdir(path.join(base, d), { recursive: true })));
  } catch {
    // ignore
  }
}

const port = Number(process.env.CORE_PORT || 3001);

// Register all channel plugins
registerAllChannels();

ensureWorkspace()
  .then(() => seedHubSkills().catch(() => {}))
  .then(() => initializeChannels().catch((err) => console.error('Channel init error:', err)))
  .finally(() => {
    console.log(`Core API listening on http://localhost:${port}`);
    serve({ fetch: app.fetch, port });
  });
