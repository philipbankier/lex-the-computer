import { Hono } from 'hono';
import { env } from '../lib/env.js';

export const modelsRouter = new Hono();

modelsRouter.get('/', async (c) => {
  try {
    const res = await fetch(`${env.LITELLM_BASE_URL.replace(/\/$/, '')}/v1/models`);
    if (res.ok) {
      const json = await res.json();
      return c.json(json);
    }
  } catch {}
  return c.json({
    data: [
      { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
      { id: 'claude-3-haiku', object: 'model', owned_by: 'anthropic' },
    ],
  });
});

