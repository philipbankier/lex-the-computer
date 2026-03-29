import { Hono } from 'hono';
import { getDb } from '../lib/db.js';

export const healthRouter = new Hono();

// Basic liveness — returns 200 if server is up
healthRouter.get('/health', (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

// Readiness — checks DB and Redis connectivity
healthRouter.get('/ready', async (c) => {
  const checks: Record<string, { ok: boolean; latency?: number; error?: string }> = {};

  // DB check
  const dbStart = Date.now();
  try {
    const db = await getDb();
    await db.execute({ sql: 'SELECT 1', params: [] } as any);
    checks.database = { ok: true, latency: Date.now() - dbStart };
  } catch (err: any) {
    checks.database = { ok: false, error: err.message, latency: Date.now() - dbStart };
  }

  // Redis check
  const redisStart = Date.now();
  try {
    const { default: IORedis } = await import('ioredis');
    const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    await redis.ping();
    checks.redis = { ok: true, latency: Date.now() - redisStart };
    await redis.disconnect();
  } catch (err: any) {
    checks.redis = { ok: false, error: err.message, latency: Date.now() - redisStart };
  }

  const allOk = Object.values(checks).every((ch) => ch.ok);
  return c.json({ ok: allOk, checks }, allOk ? 200 : 503);
});
