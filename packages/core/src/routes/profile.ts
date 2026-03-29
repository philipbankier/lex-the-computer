import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';

export const profileRouter = new Hono();
const userIdFromCtx = () => 1;

profileRouter.get('/', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const [user] = await db.select().from(schema.users).where({ id } as any).limit(1);
  if (!user) return c.json({ error: 'Not found' }, 404);

  // Also fetch profile extras
  const [profile] = await db.select().from(schema.user_profiles).where({ user_id: id } as any).limit(1);

  return c.json({
    name: user.name,
    bio: user.bio,
    avatar: user.avatar,
    social_links: profile?.social_links || {},
    language: (profile as any)?.language || '',
    timezone: (profile as any)?.timezone || '',
    share_location: (profile as any)?.share_location || false,
  });
});

profileRouter.patch('/', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const body = await c.req.json();

  // Update users table
  const [user] = await db.update(schema.users).set({ name: body.name, bio: body.bio } as any).where({ id } as any).returning();

  // Upsert user_profiles for extended fields
  if (body.social_links || body.language !== undefined || body.timezone !== undefined || body.share_location !== undefined) {
    const [existing] = await db.select().from(schema.user_profiles).where({ user_id: id } as any).limit(1);
    const profileData: any = { updated_at: new Date() };
    if (body.social_links) profileData.social_links = body.social_links;
    if (body.language !== undefined) profileData.language = body.language;
    if (body.timezone !== undefined) profileData.timezone = body.timezone;
    if (body.share_location !== undefined) profileData.share_location = body.share_location;

    if (existing) {
      await db.update(schema.user_profiles).set(profileData).where({ id: existing.id } as any);
    } else {
      await db.insert(schema.user_profiles).values({ user_id: id, ...profileData } as any);
    }
  }

  return c.json({ name: user.name, bio: user.bio, avatar: user.avatar });
});

profileRouter.post('/avatar', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const body = await c.req.json();
  const [user] = await db.update(schema.users).set({ avatar: body.avatar } as any).where({ id } as any).returning();
  return c.json({ avatar: user.avatar });
});
