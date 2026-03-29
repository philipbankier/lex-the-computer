import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { env } from '../lib/env.js';
import {
  generatePairingCode,
  getChannel,
  getConfiguredChannelTypes,
  generateSmsVerification,
  validateSmsVerification,
  twilioSend,
} from '../services/channels/index.js';

export const channelsRouter = new Hono();

const userIdFromCtx = () => 1; // Phase 0 placeholder

// ─── List user's channel connections ─────────────────────────────────
channelsRouter.get('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const rows = await db.select().from(schema.channels).where({ user_id: userId } as any);
  // Strip sensitive config fields
  const safe = rows.map((r) => ({
    id: r.id,
    type: r.type,
    persona_id: r.persona_id,
    is_active: r.is_active,
    paired_at: r.paired_at,
    config: sanitizeConfig(r.type, r.config as any),
  }));
  return c.json(safe);
});

// ─── List which channels have env vars configured ────────────────────
channelsRouter.get('/available', async (c) => {
  const types = ['telegram', 'email', 'discord', 'sms'];
  const available = types.map((t) => ({
    type: t,
    configured: getConfiguredChannelTypes().includes(t),
    envHint: getEnvHint(t),
  }));
  return c.json(available);
});

// ─── Start pairing flow ──────────────────────────────────────────────
channelsRouter.post('/:type/pair', async (c) => {
  const type = c.req.param('type');
  const userId = userIdFromCtx();

  if (type === 'telegram') {
    const code = generatePairingCode(userId, 'telegram');
    const botUsername = env.TELEGRAM_BOT_TOKEN ? 'your Lex bot' : '';
    return c.json({ code, instructions: `Send this code to ${botUsername} on Telegram`, expiresIn: '10 minutes' });
  }

  if (type === 'discord') {
    const code = generatePairingCode(userId, 'discord');
    const inviteUrl = env.DISCORD_APPLICATION_ID
      ? `https://discord.com/api/oauth2/authorize?client_id=${env.DISCORD_APPLICATION_ID}&permissions=0&scope=bot%20applications.commands`
      : '';
    return c.json({ code, inviteUrl, instructions: 'Add the bot to your server, then DM the bot with this code', expiresIn: '10 minutes' });
  }

  if (type === 'email') {
    if (!env.EMAIL_PROVIDER || !env.EMAIL_DOMAIN) return c.json({ error: 'Email not configured' }, 400);
    const db = await getDb();
    const [user] = await db.select().from(schema.users).where({ id: userId } as any).limit(1);
    const handle = user?.handle || user?.email?.split('@')[0] || 'user';
    const emailAddr = `${handle}@${env.EMAIL_DOMAIN}`;
    // Auto-create email channel
    const existing = await db.select().from(schema.channels).where({ user_id: userId, type: 'email' } as any);
    if (existing.length === 0) {
      await db.insert(schema.channels).values({
        user_id: userId,
        type: 'email',
        config: { email: emailAddr, handle },
        is_active: true,
      });
    }
    return c.json({ email: emailAddr, instructions: `Emails sent to ${emailAddr} will be processed by your AI` });
  }

  if (type === 'sms') {
    const body = await c.req.json().catch(() => ({}));
    const phone = (body as any).phone;
    if (!phone) return c.json({ error: 'Phone number required' }, 400);
    if (!env.TWILIO_ACCOUNT_SID) return c.json({ error: 'SMS not configured' }, 400);
    const code = generateSmsVerification(userId, phone);
    // Send verification SMS
    try {
      await twilioSend(phone, `Your Lex verification code is: ${code}`);
    } catch (err: any) {
      return c.json({ error: `Failed to send SMS: ${err?.message}` }, 500);
    }
    return c.json({ instructions: 'Check your phone for a verification code', expiresIn: '10 minutes' });
  }

  return c.json({ error: 'Unknown channel type' }, 400);
});

// ─── Verify pairing code (SMS) ──────────────────────────────────────
channelsRouter.post('/:type/verify', async (c) => {
  const type = c.req.param('type');
  const userId = userIdFromCtx();

  if (type === 'sms') {
    const body = await c.req.json().catch(() => ({}));
    const { phone, code } = body as any;
    if (!phone || !code) return c.json({ error: 'Phone and code required' }, 400);
    const valid = validateSmsVerification(userId, phone, code);
    if (!valid) return c.json({ error: 'Invalid or expired code' }, 400);
    const db = await getDb();
    const [ch] = await db.insert(schema.channels).values({
      user_id: userId,
      type: 'sms',
      config: { phone },
      is_active: true,
    }).returning();
    return c.json({ ok: true, channel: { id: ch.id, type: 'sms', phone } });
  }

  return c.json({ error: 'Verification not supported for this channel type' }, 400);
});

// ─── Disconnect channel ──────────────────────────────────────────────
channelsRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();
  const [row] = await db.select().from(schema.channels).where({ id, user_id: userId } as any).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  await db.delete(schema.channels).where({ id } as any);
  return c.json({ ok: true });
});

// ─── Update channel settings ─────────────────────────────────────────
channelsRouter.put('/:id', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();
  const body = await c.req.json();
  const updates: any = { updated_at: new Date() };
  if ('persona_id' in body) updates.persona_id = body.persona_id;
  if ('is_active' in body) updates.is_active = body.is_active;
  const [row] = await db.update(schema.channels).set(updates).where({ id } as any).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// ─── Test channel ────────────────────────────────────────────────────
channelsRouter.post('/:id/test', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const [row] = await db.select().from(schema.channels).where({ id } as any).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);

  const plugin = getChannel(row.type);
  if (!plugin) return c.json({ error: `${row.type} plugin not available` }, 400);

  try {
    await plugin.sendMessage(id, 'This is a test message from Lex!');
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ ok: false, error: err?.message || 'Send failed' });
  }
});

// ─── Webhook: Email inbound ──────────────────────────────────────────
channelsRouter.post('/email/inbound', async (c) => {
  // Verify webhook secret if configured
  if (env.EMAIL_WEBHOOK_SECRET) {
    const sig = c.req.header('x-webhook-secret') || c.req.header('x-mailgun-signature') || '';
    // Simple check — production would use HMAC
    if (sig && sig !== env.EMAIL_WEBHOOK_SECRET) return c.json({ error: 'Unauthorized' }, 401);
  }

  const plugin = getChannel('email');
  if (!plugin) return c.json({ error: 'Email not configured' }, 400);

  try {
    const body = await c.req.json().catch(() => ({}));
    await plugin.handleInbound(body);
    return c.json({ ok: true });
  } catch (err: any) {
    console.error('Email inbound error:', err?.message || err);
    return c.json({ error: err?.message || 'Processing failed' }, 500);
  }
});

// ─── Webhook: SMS inbound (Twilio) ───────────────────────────────────
channelsRouter.post('/sms/inbound', async (c) => {
  const plugin = getChannel('sms');
  if (!plugin) return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, { 'Content-Type': 'text/xml' });

  try {
    // Twilio sends form-encoded data
    const text = await c.req.text();
    const params = Object.fromEntries(new URLSearchParams(text));
    await plugin.handleInbound(params);
    // Twilio expects TwiML response — empty response since we send via API
    return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, { 'Content-Type': 'text/xml' });
  } catch (err: any) {
    console.error('SMS inbound error:', err?.message || err);
    return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, { 'Content-Type': 'text/xml' });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────

function sanitizeConfig(type: string, config: any) {
  if (!config) return {};
  switch (type) {
    case 'telegram': return { username: config.username, first_name: config.first_name };
    case 'discord': return { username: config.username };
    case 'email': return { email: config.email };
    case 'sms': return { phone: config.phone };
    default: return {};
  }
}

function getEnvHint(type: string): string {
  switch (type) {
    case 'telegram': return 'TELEGRAM_BOT_TOKEN';
    case 'discord': return 'DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID';
    case 'email': return 'EMAIL_PROVIDER, EMAIL_DOMAIN';
    case 'sms': return 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER';
    default: return '';
  }
}
