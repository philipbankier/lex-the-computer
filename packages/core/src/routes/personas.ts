import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';

export const personasRouter = new Hono();
const asInt = (v: string) => Number.parseInt(v, 10);
const userIdFromCtx = () => 1;

personasRouter.post('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json();
  const [row] = await db.insert(schema.personas).values({ user_id, name: body.name, prompt: body.prompt, is_default: !!body.is_default }).returning();
  return c.json(row);
});

personasRouter.get('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.personas).where({ user_id } as any);
  return c.json(rows);
});

personasRouter.patch('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json();
  const [row] = await db.update(schema.personas).set({ name: body.name, prompt: body.prompt, is_default: !!body.is_default } as any).where({ id } as any).returning();
  return c.json(row);
});

personasRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  await db.delete(schema.personas).where({ id } as any);
  return c.json({ ok: true });
});

personasRouter.post('/:id/activate', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const id = asInt(c.req.param('id'));
  // Set all to not default, mark selected as default for simplicity
  await db.update(schema.personas).set({ is_default: false } as any).where({ user_id } as any);
  await db.update(schema.personas).set({ is_default: true } as any).where({ id } as any);
  return c.json({ ok: true });
});
