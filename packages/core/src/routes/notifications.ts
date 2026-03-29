import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq, desc, and } from 'drizzle-orm';

export const notificationsRouter = new Hono();
const userIdFromCtx = () => 1;

// List notifications (most recent first)
notificationsRouter.get('/', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const limit = parseInt(c.req.query('limit') || '20');
  const rows = await db.select().from(schema.notifications)
    .where(eq(schema.notifications.user_id, id))
    .orderBy(desc(schema.notifications.created_at))
    .limit(limit);
  return c.json(rows);
});

// Unread count
notificationsRouter.get('/unread-count', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const rows = await db.select().from(schema.notifications)
    .where(and(eq(schema.notifications.user_id, id), eq(schema.notifications.read, false)));
  return c.json({ count: rows.length });
});

// Mark as read
notificationsRouter.post('/:id/read', async (c) => {
  const db = await getDb();
  const nId = parseInt(c.req.param('id'));
  await db.update(schema.notifications).set({ read: true } as any).where(eq(schema.notifications.id, nId));
  return c.json({ ok: true });
});

// Mark all as read
notificationsRouter.post('/read-all', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  await db.update(schema.notifications).set({ read: true } as any)
    .where(and(eq(schema.notifications.user_id, id), eq(schema.notifications.read, false)));
  return c.json({ ok: true });
});
