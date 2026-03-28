import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { scheduleAutomation, removeAutomationSchedule, runAutomationNow, ensureWorker } from '../lib/queue.js';
import { runAutomation } from '../services/automation-runner.js';

export const automationsRouter = new Hono();

const asInt = (v: string) => Number.parseInt(v, 10);
const userIdFromCtx = () => 1; // Phase 0 placeholder auth

// Ensure worker bootstrapped (no-op if BullMQ unavailable)
void ensureWorker(runAutomation);

automationsRouter.post('/', async (c) => {
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
  const [row] = await db.insert(schema.automations).values(values).returning();
  if (row.schedule && row.is_active) {
    await scheduleAutomation(row.id, row.schedule);
  }
  return c.json(row);
});

automationsRouter.get('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const autos = await db.select().from(schema.automations).where({ user_id: userId } as any).limit(100);
  return c.json(autos);
});

automationsRouter.get('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const auto = (await db.select().from(schema.automations).where({ id } as any).limit(1))[0];
  if (!auto) return c.json({ error: 'Not found' }, 404);
  return c.json(auto);
});

automationsRouter.patch('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json();
  const partial: any = {};
  for (const k of ['name', 'instruction', 'schedule', 'model', 'delivery', 'is_active']) {
    if (k in body) partial[k] = body[k];
  }
  const [row] = await db.update(schema.automations).set(partial as any).where({ id } as any).returning();
  if (row) {
    // Update schedule
    await removeAutomationSchedule(row.id);
    if (row.schedule && row.is_active) await scheduleAutomation(row.id, row.schedule);
  }
  return c.json(row);
});

automationsRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  await removeAutomationSchedule(id);
  await db.delete(schema.automation_runs).where({ automation_id: id } as any);
  await db.delete(schema.automations).where({ id } as any);
  return c.json({ ok: true });
});

automationsRouter.post('/:id/toggle', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const auto = (await db.select().from(schema.automations).where({ id } as any).limit(1))[0];
  if (!auto) return c.json({ error: 'Not found' }, 404);
  const isActive = body.is_active ?? !auto.is_active;
  const [row] = await db.update(schema.automations).set({ is_active: isActive } as any).where({ id } as any).returning();
  await removeAutomationSchedule(id);
  if (row.schedule && row.is_active) await scheduleAutomation(id, row.schedule);
  return c.json(row);
});

automationsRouter.post('/:id/run', async (c) => {
  const id = asInt(c.req.param('id'));
  await runAutomationNow(id);
  return c.json({ queued: true });
});

automationsRouter.get('/:id/runs', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const runs = await db
    .select()
    .from(schema.automation_runs)
    .where({ automation_id: id } as any)
    .limit(50);
  // naive most-recent-first by client; keeping simple without orderBy helper
  return c.json(runs.reverse());
});

automationsRouter.get('/:id/runs/:runId', async (c) => {
  const db = await getDb();
  const runId = asInt(c.req.param('runId'));
  const run = (await db.select().from(schema.automation_runs).where({ id: runId } as any).limit(1))[0];
  if (!run) return c.json({ error: 'Not found' }, 404);
  return c.json(run);
});

