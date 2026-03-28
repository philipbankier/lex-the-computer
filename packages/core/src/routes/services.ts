import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { startService, stopService, restartService, getServiceLogs } from '../services/service-runner.js';

export const servicesRouter = new Hono();
const userIdFromCtx = () => 1;

servicesRouter.post('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json().catch(() => ({} as any));
  const { name, type, port, entrypoint, working_dir, env_vars } = body;
  if (!name || !type) return c.json({ error: 'name and type required' }, 400);
  const [row] = await db
    .insert(schema.services)
    .values({ user_id, name, type, port: port ?? null, entrypoint: entrypoint || null, working_dir: working_dir || null, env_vars: env_vars || null, is_running: false } as any)
    .returning();
  return c.json(row);
});

servicesRouter.get('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.services).where({ user_id } as any);
  return c.json(rows);
});

servicesRouter.get('/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.services).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json(row);
});

servicesRouter.patch('/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({} as any));
  const updates: any = {};
  for (const k of ['name', 'type', 'port', 'entrypoint', 'working_dir', 'env_vars']) if (k in body) updates[k] = body[k];
  const [row] = await db.update(schema.services).set(updates).where({ id } as any).returning();
  return c.json(row);
});

servicesRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  await stopService(id);
  await db.delete(schema.services).where({ id } as any);
  return c.json({ ok: true });
});

servicesRouter.post('/:id/start', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const status = await startService(id);
  return c.json({ ok: true, status });
});

servicesRouter.post('/:id/stop', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const status = await stopService(id);
  return c.json({ ok: true, status });
});

servicesRouter.post('/:id/restart', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const status = await restartService(id);
  return c.json({ ok: true, status });
});

servicesRouter.get('/:id/logs', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const lines = getServiceLogs(id, 1000);
  return c.json({ lines });
});

