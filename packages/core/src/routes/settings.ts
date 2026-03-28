import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';

export const settingsRouter = new Hono();
const userIdFromCtx = () => 1;

// BYOK providers management using secrets table
settingsRouter.get('/providers', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.secrets).where({ user_id } as any);
  const providers = ['openai', 'anthropic', 'google', 'mistral', 'groq', 'openrouter'];
  const masked = providers.map((p) => {
    const secret = rows.find((r) => r.key === `provider:${p}`);
    return { provider: p, configured: !!secret };
  });
  return c.json(masked);
});

settingsRouter.post('/providers', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json();
  const key = `provider:${body.provider}`;
  // upsert
  const existing = await db.select().from(schema.secrets).where({ user_id, key } as any).limit(1);
  if (existing[0]) {
    await db.update(schema.secrets).set({ value_encrypted: body.api_key } as any).where({ id: existing[0].id } as any);
  } else {
    await db.insert(schema.secrets).values({ user_id, key, value_encrypted: body.api_key });
  }
  return c.json({ ok: true });
});

settingsRouter.delete('/providers/:provider', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const provider = c.req.param('provider');
  const key = `provider:${provider}`;
  await db.delete(schema.secrets).where({ user_id, key } as any);
  return c.json({ ok: true });
});

