// Phase 10: SSH routes

import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import * as sshService from '../services/ssh.js';

export const sshRouter = new Hono();
const userIdFromCtx = () => 1; // Phase 0 placeholder

// GET /api/ssh/keys — list saved SSH connections
sshRouter.get('/keys', async (c) => {
  const keys = await sshService.listKeys();
  return c.json(keys);
});

// POST /api/ssh/keys — add SSH connection
sshRouter.post('/keys', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const body = await c.req.json();

  if (!body.name || !body.host || !body.username) {
    return c.json({ error: 'name, host, and username are required' }, 400);
  }

  const [row] = await db.insert(schema.ssh_keys).values({
    user_id: userId,
    name: body.name,
    host: body.host,
    port: body.port || 22,
    username: body.username,
    private_key: body.private_key || null,
    passphrase: body.passphrase || null,
    fingerprint: body.fingerprint || null,
  } as any).returning();

  return c.json({
    ok: true,
    key: { id: row.id, name: row.name, host: row.host, port: row.port, username: row.username },
  });
});

// DELETE /api/ssh/keys/:id — remove
sshRouter.delete('/keys/:id', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();
  const [existing] = await db.select().from(schema.ssh_keys).where(eq(schema.ssh_keys.id, id)).limit(1);
  if (!existing || existing.user_id !== userId) return c.json({ error: 'Not found' }, 404);
  await db.delete(schema.ssh_keys).where(eq(schema.ssh_keys.id, id));
  return c.json({ ok: true });
});

// POST /api/ssh/keys/:id/test — test connection
sshRouter.post('/keys/:id/test', async (c) => {
  const id = Number(c.req.param('id'));
  const result = await sshService.testConnection(id);
  return c.json(result);
});

// POST /api/ssh/exec — execute command on remote host
sshRouter.post('/exec', async (c) => {
  const body = await c.req.json();
  if (!body.host || !body.command) {
    return c.json({ error: 'host and command are required' }, 400);
  }
  try {
    const result = await sshService.exec(body.host, body.command);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
