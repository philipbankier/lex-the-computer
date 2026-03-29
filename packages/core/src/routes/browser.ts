// Phase 10: Browser routes (session management)

import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import * as browserService from '../services/browser.js';

export const browserRouter = new Hono();
const userIdFromCtx = () => 1; // Phase 0 placeholder

// GET /api/browser/sessions — list saved browser sessions
browserRouter.get('/sessions', async (c) => {
  const result = await browserService.listSessions();
  return c.json(result.sessions);
});

// POST /api/browser/sessions — save a browser session (after login)
browserRouter.post('/sessions', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const body = await c.req.json();

  if (!body.site_url) {
    return c.json({ error: 'site_url is required' }, 400);
  }

  const [row] = await db.insert(schema.browser_sessions).values({
    user_id: userId,
    site_url: body.site_url,
    label: body.label || body.site_url,
  } as any).returning();

  return c.json({ ok: true, session: { id: row.id, site_url: row.site_url, label: row.label } });
});

// DELETE /api/browser/sessions/:id — delete a browser session
browserRouter.delete('/sessions/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await browserService.deleteSession(id);
  return c.json({ ok: true });
});

// POST /api/browser/navigate — navigate to URL (for login flow)
browserRouter.post('/navigate', async (c) => {
  const body = await c.req.json();
  if (!body.url) return c.json({ error: 'url is required' }, 400);
  const result = await browserService.navigateTo(body.url);
  return c.json(result);
});

// POST /api/browser/screenshot — take screenshot
browserRouter.post('/screenshot', async (c) => {
  const body = await c.req.json();
  const result = await browserService.screenshot(body.url);
  return c.json(result);
});
