import { Hono } from 'hono';

export const terminalRouter = new Hono();

// Placeholder: WebSocket-based terminal requires hono/ws or ws. Network is restricted,
// so we ship a 501 here and implement front-end fallback.
terminalRouter.get('/ws', (c) => c.json({ error: 'Terminal WebSocket not implemented in this build' }, 501));
