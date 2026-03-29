import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';

export const bookmarksRouter = new Hono();
const userIdFromCtx = () => 1;

// List bookmarks
bookmarksRouter.get('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const rows = await db.select().from(schema.bookmarks).where({ user_id: userId } as any);
  return c.json(rows);
});

// Create bookmark
bookmarksRouter.post('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const body = await c.req.json();
  const [row] = await db.insert(schema.bookmarks)
    .values({
      user_id: userId,
      type: body.type || 'tab',
      target_id: body.target_id || null,
      name: body.name,
      href: body.href || null,
    } as any)
    .returning();
  return c.json(row);
});

// Delete bookmark
bookmarksRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  await db.delete(schema.bookmarks).where({ id } as any);
  return c.json({ ok: true });
});
