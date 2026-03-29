import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export const apiKeysRouter = new Hono();
const userIdFromCtx = () => 1; // Phase 0 placeholder auth

// Simple hash function (SHA-256) for API keys
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `lex_${random}`;
}

// List API keys (never expose full key)
apiKeysRouter.get('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const rows = await db.select().from(schema.api_keys).where(eq(schema.api_keys.user_id, userId));
  return c.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    key_prefix: r.key_prefix,
    last_used_at: r.last_used_at,
    expires_at: r.expires_at,
    is_active: r.is_active,
    created_at: r.created_at,
  })));
});

// Create a new API key (returns the full key ONCE)
apiKeysRouter.post('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const body = await c.req.json().catch(() => ({} as any));
  const name = String(body.name || '').trim();
  if (!name) return c.json({ error: 'name required' }, 400);

  const key = generateApiKey();
  const keyHash = hashKey(key);
  const keyPrefix = key.slice(0, 12) + '...';

  const expiresAt = body.expires_in_days
    ? new Date(Date.now() + body.expires_in_days * 24 * 60 * 60 * 1000)
    : null;

  const [row] = await db.insert(schema.api_keys).values({
    user_id: userId,
    name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    expires_at: expiresAt,
    is_active: true,
  } as any).returning();

  return c.json({
    id: row.id,
    name: row.name,
    key: key, // Only returned once at creation time
    key_prefix: keyPrefix,
    expires_at: row.expires_at,
    created_at: row.created_at,
    warning: 'Save this key now. You will not be able to see it again.',
  });
});

// Update API key (name, active toggle)
apiKeysRouter.put('/:id', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();
  const body = await c.req.json();

  const [existing] = await db.select().from(schema.api_keys).where(eq(schema.api_keys.id, id)).limit(1);
  if (!existing || existing.user_id !== userId) return c.json({ error: 'Not found' }, 404);

  const updates: any = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const [row] = await db.update(schema.api_keys).set(updates).where(eq(schema.api_keys.id, id)).returning();
  return c.json({ ok: true, key: { id: row.id, name: row.name, is_active: row.is_active } });
});

// Revoke (delete) API key
apiKeysRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();

  const [existing] = await db.select().from(schema.api_keys).where(eq(schema.api_keys.id, id)).limit(1);
  if (!existing || existing.user_id !== userId) return c.json({ error: 'Not found' }, 404);

  await db.delete(schema.api_keys).where(eq(schema.api_keys.id, id));
  return c.json({ ok: true });
});

// Validate an API key — used by middleware, exported for reuse
export async function validateApiKey(key: string): Promise<{ valid: boolean; userId?: number }> {
  if (!key || !key.startsWith('lex_')) return { valid: false };

  const db = await getDb();
  const keyHash = hashKey(key);
  const rows = await db.select().from(schema.api_keys).where(eq(schema.api_keys.key_hash, keyHash)).limit(1);

  if (!rows.length) return { valid: false };
  const row = rows[0];

  if (!row.is_active) return { valid: false };
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { valid: false };

  // Update last used
  await db.update(schema.api_keys).set({ last_used_at: new Date() } as any).where(eq(schema.api_keys.id, row.id));

  return { valid: true, userId: row.user_id };
}
