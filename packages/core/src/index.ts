import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import type { Context } from 'hono';

import { chatRouter } from './routes/chat.js';
import { personasRouter } from './routes/personas.js';
import { rulesRouter } from './routes/rules.js';
import { profileRouter } from './routes/profile.js';
import { settingsRouter } from './routes/settings.js';
import { modelsRouter } from './routes/models.js';
import { filesRouter } from './routes/files.js';

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

app.get('/api/automations', notImplemented);
app.post('/api/automations', notImplemented);
app.get('/api/automations/:id', notImplemented);

app.get('/api/sites', notImplemented);
app.post('/api/sites', notImplemented);

app.get('/api/skills', notImplemented);
app.get('/api/skills/hub', notImplemented);

app.get('/api/settings', notImplemented);
app.put('/api/settings', notImplemented);

app.get('/api/system/stats', notImplemented);

const port = Number(process.env.CORE_PORT || 3001);
console.log(`Core API listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
