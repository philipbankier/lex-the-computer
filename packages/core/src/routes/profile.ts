import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';

export const profileRouter = new Hono();
const userIdFromCtx = () => 1;

profileRouter.get('/', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const [user] = await db.select().from(schema.users).where({ id } as any).limit(1);
  if (!user) return c.json({ error: 'Not found' }, 404);
  return c.json({ name: user.name, bio: user.bio, avatar: user.avatar });
});

profileRouter.patch('/', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const body = await c.req.json();
  const [user] = await db.update(schema.users).set({ name: body.name, bio: body.bio } as any).where({ id } as any).returning();
  return c.json({ name: user.name, bio: user.bio, avatar: user.avatar });
});

profileRouter.post('/avatar', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  // Simplified: expect JSON { avatar }
  const body = await c.req.json();
  const [user] = await db.update(schema.users).set({ avatar: body.avatar } as any).where({ id } as any).returning();
  return c.json({ avatar: user.avatar });
});

