import type { Context, Next } from 'hono';

// Simple in-memory rate limiter (swap for Redis in production)
const buckets = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX = 60; // 60 requests per minute

export function rateLimiter(opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const max = opts?.max ?? DEFAULT_MAX;

  return async (c: Context, next: Next) => {
    // Use IP + path as key; in multi-user mode, use userId
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    await next();
  };
}

// Periodic cleanup of expired buckets
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 60_000);
