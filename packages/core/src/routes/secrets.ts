import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';

export const secretsRouter = new Hono();
const userIdFromCtx = () => 1;

// List keys only
secretsRouter.get('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.secrets).where({ user_id } as any);
  const items = rows.map((r) => ({ key: r.key, created_at: r.created_at }));
  return c.json({ secrets: items });
});

// Create/update
secretsRouter.post('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json().catch(() => ({} as any));
  const key = String(body.key || '').trim();
  const value = String(body.value || '').trim();
  if (!key) return c.json({ error: 'key required' }, 400);
  const existing = (await db.select().from(schema.secrets).where({ user_id, key } as any).limit(1))[0];
  if (existing) {
    await db.update(schema.secrets).set({ value_encrypted: value } as any).where({ id: existing.id } as any);
  } else {
    await db.insert(schema.secrets).values({ user_id, key, value_encrypted: value });
  }
  return c.json({ ok: true });
});

// Delete
secretsRouter.delete('/:key', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const key = c.req.param('key');
  await db.delete(schema.secrets).where({ user_id, key } as any);
  return c.json({ ok: true });
});

