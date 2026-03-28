import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';

export const rulesRouter = new Hono();
const asInt = (v: string) => Number.parseInt(v, 10);
const userIdFromCtx = () => 1;

rulesRouter.post('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json();
  const [row] = await db
    .insert(schema.rules)
    .values({ user_id, condition: body.condition || null, prompt: body.prompt || '', is_active: body.is_active !== false })
    .returning();
  return c.json(row);
});

rulesRouter.get('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.rules).where({ user_id } as any);
  return c.json(rows);
});

rulesRouter.patch('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json();
  const [row] = await db.update(schema.rules).set({ condition: body.condition, prompt: body.prompt, is_active: body.is_active } as any).where({ id } as any).returning();
  return c.json(row);
});

rulesRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  await db.delete(schema.rules).where({ id } as any);
  return c.json({ ok: true });
});
