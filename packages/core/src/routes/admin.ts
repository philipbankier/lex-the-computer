import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { env } from '../lib/env.js';
import { eq, sql, desc, count } from 'drizzle-orm';
import { getAllUsage } from '../services/usage.js';
import { listContainers, startContainer, stopContainer } from '../services/container-manager.js';
import os from 'node:os';

export const adminRouter = new Hono();

// Admin guard: only admin users
const requireAdmin = async (c: any, next: any) => {
  // TODO: real auth — for now check header or allow in single-user mode
  if (env.MULTI_USER) {
    // In multi-user mode, check user role
    const userId = 1; // TODO: from session
    const db = await getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!rows[0] || rows[0].role !== 'admin') {
      return c.json({ error: 'Unauthorized — admin access required' }, 403);
    }
  }
  await next();
};

adminRouter.use('*', requireAdmin);

// ── System Stats ─────────────────────────────────────────────────────

adminRouter.get('/stats', async (c) => {
  const db = await getDb();

  const [userCount] = await db.select({ count: count() }).from(schema.users);
  const [convCount] = await db.select({ count: count() }).from(schema.conversations);
  const [agentCount] = await db.select({ count: count() }).from(schema.agents);

  let containerStats = { total: 0, running: 0, stopped: 0 };
  if (env.MULTI_USER) {
    try {
      const containers = await listContainers();
      containerStats = {
        total: containers.length,
        running: containers.filter((c) => c.status === 'running').length,
        stopped: containers.filter((c) => c.status === 'stopped').length,
      };
    } catch {
      // dockerode not available
    }
  }

  return c.json({
    system: {
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    counts: {
      users: userCount.count,
      conversations: convCount.count,
      agents: agentCount.count,
    },
    containers: containerStats,
    multiUser: env.MULTI_USER,
  });
});

// ── User Management ──────────────────────────────────────────────────

adminRouter.get('/users', async (c) => {
  const db = await getDb();
  const users = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    handle: schema.users.handle,
    name: schema.users.name,
    role: schema.users.role,
    is_disabled: schema.users.is_disabled,
    created_at: schema.users.created_at,
  }).from(schema.users).orderBy(desc(schema.users.created_at));

  return c.json(users);
});

adminRouter.get('/users/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const db = await getDb();

  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!rows[0]) return c.json({ error: 'Not found' }, 404);

  // Get usage
  const usage = await getAllUsage();
  const userUsage = usage.filter((u) => u.userId === id);

  // Get container info
  let container = null;
  if (env.MULTI_USER) {
    const cRows = await db.select().from(schema.user_containers).where(eq(schema.user_containers.user_id, id));
    container = cRows[0] || null;
  }

  return c.json({ user: rows[0], usage: userUsage, container });
});

adminRouter.patch('/users/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json();
  const db = await getDb();

  const updates: Record<string, any> = {};
  if (body.role !== undefined) updates.role = body.role;
  if (body.is_disabled !== undefined) updates.is_disabled = body.is_disabled;

  if (Object.keys(updates).length > 0) {
    await db.update(schema.users).set(updates).where(eq(schema.users.id, id));
  }

  return c.json({ ok: true });
});

// ── Container Management ─────────────────────────────────────────────

adminRouter.get('/containers', async (c) => {
  if (!env.MULTI_USER) return c.json([]);
  try {
    const containers = await listContainers();
    return c.json(containers);
  } catch {
    return c.json([]);
  }
});

adminRouter.post('/containers/:userId/start', async (c) => {
  const userId = Number.parseInt(c.req.param('userId'), 10);
  try {
    await startContainer(userId);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

adminRouter.post('/containers/:userId/stop', async (c) => {
  const userId = Number.parseInt(c.req.param('userId'), 10);
  try {
    await stopContainer(userId);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Usage / Billing Overview ─────────────────────────────────────────

adminRouter.get('/usage', async (c) => {
  const usage = await getAllUsage();
  return c.json(usage);
});

adminRouter.get('/billing', async (c) => {
  const db = await getDb();

  // Revenue from Stripe orders (paid)
  const [revenue] = await db.select({
    total: sql<number>`coalesce(sum(${schema.stripe_orders.amount}), 0)`,
    count: count(),
  }).from(schema.stripe_orders).where(eq(schema.stripe_orders.payment_status, 'paid'));

  return c.json({
    totalRevenue: Number(revenue.total) || 0,
    totalOrders: revenue.count,
  });
});
