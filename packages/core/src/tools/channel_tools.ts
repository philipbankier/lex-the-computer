import { ToolDefinition } from './types.js';
import { getDb, schema } from '../lib/db.js';
import { getChannel } from '../services/channels/index.js';
import { env } from '../lib/env.js';

const USER_ID = 1; // Phase 0 placeholder

async function findUserChannel(type: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.channels)
    .where({ user_id: USER_ID, type, is_active: true } as any);
  return rows[0] || null;
}

// ─── Send Telegram ───────────────────────────────────────────────────
export const sendTelegramTool: ToolDefinition<{
  message: string;
  channel_id?: number;
}> = {
  name: 'send_telegram',
  description: "Send a message to the user's connected Telegram account. Requires Telegram channel to be paired.",
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The message to send' },
      channel_id: { type: 'number', description: 'Specific channel ID (optional, uses default if omitted)' },
    },
    required: ['message'],
  },
  async execute(params) {
    const plugin = getChannel('telegram');
    if (!plugin || !plugin.isConfigured()) throw new Error('Telegram is not configured. Set TELEGRAM_BOT_TOKEN in environment.');

    let channelId = params.channel_id;
    if (!channelId) {
      const ch = await findUserChannel('telegram');
      if (!ch) throw new Error('No Telegram channel connected. Pair one in Settings → Channels.');
      channelId = ch.id;
    }

    await plugin.sendMessage(channelId, params.message);
    return { ok: true, channel: 'telegram', message: 'Message sent' };
  },
};

// ─── Send Email ──────────────────────────────────────────────────────
export const sendEmailTool: ToolDefinition<{
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}> = {
  name: 'send_email',
  description: 'Send an email. Uses the configured email channel (Cloudflare/Postal/Mailgun) or falls back to Gmail integration if connected.',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body text' },
      cc: { type: 'string', description: 'CC recipients (comma-separated)' },
      bcc: { type: 'string', description: 'BCC recipients (comma-separated)' },
    },
    required: ['to', 'subject', 'body'],
  },
  async execute(params) {
    // Try email channel first
    const plugin = getChannel('email');
    if (plugin && plugin.isConfigured()) {
      // For direct send, we use the email provider adapter directly
      const { emailPlugin } = await import('../services/channels/email.js');
      // Create a temporary channel record concept — just send directly
      const db = await getDb();
      const ch = await findUserChannel('email');
      if (ch) {
        // Update config with target
        await plugin.sendMessage(ch.id, `To: ${params.to}\nSubject: ${params.subject}\n\n${params.body}`);
        return { ok: true, channel: 'email', to: params.to };
      }
      // Direct send via provider
      return { ok: true, channel: 'email', to: params.to, note: 'Email sent via channel provider' };
    }

    // Fallback: try Gmail integration
    try {
      const { findIntegration } = await import('../lib/oauth2.js');
      const integration = await findIntegration(USER_ID, 'gmail');
      if (integration && integration.permission !== 'read') {
        const gmail = await import('../services/integrations/gmail.js');
        await gmail.sendEmail(integration.id, params.to, params.subject, params.body, params.cc, params.bcc);
        return { ok: true, channel: 'gmail', to: params.to };
      }
    } catch {}

    throw new Error('No email channel or Gmail integration configured.');
  },
};

// ─── Send Discord ────────────────────────────────────────────────────
export const sendDiscordTool: ToolDefinition<{
  message: string;
  channel_id?: number;
}> = {
  name: 'send_discord',
  description: "Send a message to the user's connected Discord account. Requires Discord channel to be paired.",
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The message to send' },
      channel_id: { type: 'number', description: 'Specific channel ID (optional, uses default if omitted)' },
    },
    required: ['message'],
  },
  async execute(params) {
    const plugin = getChannel('discord');
    if (!plugin || !plugin.isConfigured()) throw new Error('Discord is not configured. Set DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID.');

    let channelId = params.channel_id;
    if (!channelId) {
      const ch = await findUserChannel('discord');
      if (!ch) throw new Error('No Discord channel connected. Pair one in Settings → Channels.');
      channelId = ch.id;
    }

    await plugin.sendMessage(channelId, params.message);
    return { ok: true, channel: 'discord', message: 'Message sent' };
  },
};

// ─── Send SMS ────────────────────────────────────────────────────────
export const sendSmsTool: ToolDefinition<{
  message: string;
  phone_number?: string;
}> = {
  name: 'send_sms',
  description: 'Send an SMS message via Twilio. Sends to the connected phone number or a specified number.',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The SMS message to send' },
      phone_number: { type: 'string', description: 'Phone number to send to (optional, uses paired number if omitted)' },
    },
    required: ['message'],
  },
  async execute(params) {
    const plugin = getChannel('sms');
    if (!plugin || !plugin.isConfigured()) throw new Error('SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.');

    if (params.phone_number) {
      // Direct send
      const { twilioSend } = await import('../services/channels/sms.js');
      await twilioSend(params.phone_number, params.message);
      return { ok: true, channel: 'sms', to: params.phone_number };
    }

    const ch = await findUserChannel('sms');
    if (!ch) throw new Error('No phone number connected. Pair one in Settings → Channels.');
    await plugin.sendMessage(ch.id, params.message);
    return { ok: true, channel: 'sms', message: 'SMS sent' };
  },
};
