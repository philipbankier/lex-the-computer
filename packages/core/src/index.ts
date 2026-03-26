import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('*', cors());

app.get('/health', (c) => c.json({ ok: true }));

// Helper to return 501
const notImplemented = (c: any) => c.json({ error: 'Not Implemented' }, 501);

// API namespace
app.post('/api/auth/signup', notImplemented);
app.post('/api/auth/login', notImplemented);
app.post('/api/auth/logout', notImplemented);
app.get('/api/auth/session', notImplemented);

app.get('/api/conversations', notImplemented);
app.post('/api/conversations', notImplemented);
app.get('/api/conversations/:id', notImplemented);
app.delete('/api/conversations/:id', notImplemented);

app.post('/api/chat', notImplemented);

app.get('/api/files/*', notImplemented);
app.post('/api/files/upload', notImplemented);
app.delete('/api/files/*', notImplemented);

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

