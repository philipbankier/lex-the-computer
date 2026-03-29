import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';

export const onboardingRouter = new Hono();
const userIdFromCtx = () => 1;

// Get onboarding status
onboardingRouter.get('/status', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!user) return c.json({ completed: false });
  return c.json({ completed: user.onboarding_completed });
});

// Save profile (step 2)
onboardingRouter.post('/profile', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const body = await c.req.json();
  const { displayName, bio, interests, socialLinks } = body;

  // Update user name/bio
  await db.update(schema.users).set({ name: displayName, bio } as any).where(eq(schema.users.id, id));

  // Upsert user profile
  const existing = await db.select().from(schema.user_profiles).where(eq(schema.user_profiles.user_id, id)).limit(1);
  if (existing.length > 0) {
    await db.update(schema.user_profiles).set({
      display_name: displayName,
      bio,
      interests: interests || [],
      social_links: socialLinks || {},
      updated_at: new Date(),
    } as any).where(eq(schema.user_profiles.user_id, id));
  } else {
    await db.insert(schema.user_profiles).values({
      user_id: id,
      display_name: displayName,
      bio,
      interests: interests || [],
      social_links: socialLinks || {},
    } as any);
  }
  return c.json({ ok: true });
});

// Save persona choice (step 3)
onboardingRouter.post('/persona', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const body = await c.req.json();
  const { name, prompt } = body;

  // Set all existing personas as non-default
  await db.update(schema.personas).set({ is_default: false } as any).where(eq(schema.personas.user_id, id));

  // Create new persona as default
  const [persona] = await db.insert(schema.personas).values({
    user_id: id,
    name,
    prompt,
    is_default: true,
  } as any).returning();
  return c.json(persona);
});

// Save first automation (step 4)
onboardingRouter.post('/automation', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const body = await c.req.json();
  const { name, instruction, schedule, delivery } = body;

  const [automation] = await db.insert(schema.automations).values({
    user_id: id,
    name,
    instruction,
    schedule: schedule || '0 8 * * *',
    delivery: delivery || 'chat',
    is_active: true,
  } as any).returning();
  return c.json(automation);
});

// Complete onboarding (step 6)
onboardingRouter.post('/complete', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  await db.update(schema.users).set({ onboarding_completed: true } as any).where(eq(schema.users.id, id));
  return c.json({ ok: true });
});
