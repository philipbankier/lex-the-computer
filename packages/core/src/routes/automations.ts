import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { scheduleAgent, removeAgentSchedule, runAgentNow, ensureWorker } from '../lib/queue.js';
import { runAgent } from '../services/automation-runner.js';

export const agentsRouter = new Hono();

const asInt = (v: string) => Number.parseInt(v, 10);
const userIdFromCtx = () => 1; // Phase 0 placeholder auth

// Ensure worker bootstrapped (no-op if BullMQ unavailable)
void ensureWorker(runAgent);

agentsRouter.post('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const body = await c.req.json();
  const values: any = {
    user_id: userId,
    name: body.name,
    instruction: body.instruction || '',
    schedule: body.schedule || null,
    delivery: body.delivery_method || body.delivery || 'chat',
    model: body.model || 'gpt-4o-mini',
    is_active: body.is_active !== false,
  };
  const [row] = await db.insert(schema.agents).values(values).returning();
  if (row.schedule && row.is_active) {
    await scheduleAgent(row.id, row.schedule);
  }
  return c.json(row);
});

agentsRouter.get('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const rows = await db.select().from(schema.agents).where({ user_id: userId } as any).limit(100);
  return c.json(rows);
});

agentsRouter.get('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const agent = (await db.select().from(schema.agents).where({ id } as any).limit(1))[0];
  if (!agent) return c.json({ error: 'Not found' }, 404);
  return c.json(agent);
});

agentsRouter.patch('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json();
  const partial: any = {};
  for (const k of ['name', 'instruction', 'schedule', 'model', 'delivery', 'is_active']) {
    if (k in body) partial[k] = body[k];
  }
  const [row] = await db.update(schema.agents).set(partial as any).where({ id } as any).returning();
  if (row) {
    await removeAgentSchedule(row.id);
    if (row.schedule && row.is_active) await scheduleAgent(row.id, row.schedule);
  }
  return c.json(row);
});

agentsRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  await removeAgentSchedule(id);
  await db.delete(schema.agent_runs).where({ agent_id: id } as any);
  await db.delete(schema.agents).where({ id } as any);
  return c.json({ ok: true });
});

agentsRouter.post('/:id/toggle', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const agent = (await db.select().from(schema.agents).where({ id } as any).limit(1))[0];
  if (!agent) return c.json({ error: 'Not found' }, 404);
  const isActive = body.is_active ?? !agent.is_active;
  const [row] = await db.update(schema.agents).set({ is_active: isActive } as any).where({ id } as any).returning();
  await removeAgentSchedule(id);
  if (row.schedule && row.is_active) await scheduleAgent(id, row.schedule);
  return c.json(row);
});

agentsRouter.post('/:id/run', async (c) => {
  const id = asInt(c.req.param('id'));
  await runAgentNow(id);
  return c.json({ queued: true });
});

agentsRouter.get('/:id/runs', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const runs = await db
    .select()
    .from(schema.agent_runs)
    .where({ agent_id: id } as any)
    .limit(50);
  return c.json(runs.reverse());
});

agentsRouter.get('/:id/runs/:runId', async (c) => {
  const db = await getDb();
  const runId = asInt(c.req.param('runId'));
  const run = (await db.select().from(schema.agent_runs).where({ id: runId } as any).limit(1))[0];
  if (!run) return c.json({ error: 'Not found' }, 404);
  return c.json(run);
});
