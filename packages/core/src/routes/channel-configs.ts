import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';

export const channelConfigsRouter = new Hono();
const userIdFromCtx = () => 1;

// List all per-channel configs
channelConfigsRouter.get('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const rows = await db.select().from(schema.channel_configs).where({ user_id: userId } as any);
  return c.json(rows);
});

// Upsert config for a channel type
channelConfigsRouter.put('/:channelType', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const channelType = c.req.param('channelType');
  const body = await c.req.json();

  // Check if exists
  const [existing] = await db.select().from(schema.channel_configs)
    .where({ user_id: userId, channel_type: channelType } as any)
    .limit(1);

  if (existing) {
    const [updated] = await db.update(schema.channel_configs)
      .set({
        persona_id: body.persona_id ?? existing.persona_id,
        model: body.model ?? existing.model,
        updated_at: new Date(),
      } as any)
      .where({ id: existing.id } as any)
      .returning();
    return c.json(updated);
  }

  const [created] = await db.insert(schema.channel_configs)
    .values({
      user_id: userId,
      channel_type: channelType,
      persona_id: body.persona_id || null,
      model: body.model || null,
    } as any)
    .returning();
  return c.json(created);
});
