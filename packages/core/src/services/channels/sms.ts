import { env } from '../../lib/env.js';
import { getDb, schema } from '../../lib/db.js';
import type { ChannelPlugin } from './base.js';
import { processChannelMessage } from './base.js';

// Verification codes for SMS pairing
const verificationCodes = new Map<string, { userId: number; phone: string; code: string; expiresAt: number }>();

export function generateSmsVerification(userId: number, phone: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes.set(`${userId}:${phone}`, { userId, phone, code, expiresAt: Date.now() + 10 * 60 * 1000 });
  return code;
}

export function validateSmsVerification(userId: number, phone: string, code: string): boolean {
  const key = `${userId}:${phone}`;
  const entry = verificationCodes.get(key);
  if (!entry || entry.code !== code || entry.expiresAt < Date.now()) return false;
  verificationCodes.delete(key);
  return true;
}

async function twilioSend(to: string, body: string) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_PHONE_NUMBER;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const form = new URLSearchParams();
  form.set('To', to);
  form.set('From', from);
  form.set('Body', body);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Twilio send failed: ${res.status} ${errBody}`);
  }
  return res.json();
}

function splitSms(text: string): string[] {
  const limit = 1600;
  if (text.length <= limit) return [text];
  // Split into segments, last segment includes "... (continued in app)"
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) { chunks.push(remaining); break; }
    chunks.push(remaining.slice(0, limit - 30) + '... (continued)');
    remaining = remaining.slice(limit - 30);
  }
  return chunks;
}

export const smsPlugin: ChannelPlugin = {
  type: 'sms',

  isConfigured() {
    return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);
  },

  async initialize() {
    // SMS uses webhooks — no persistent connection.
    // Webhook route registered in channels route file.
    console.log(`SMS channel ready via Twilio: ${env.TWILIO_PHONE_NUMBER}`);
  },

  async shutdown() {
    // Nothing to clean up
  },

  async sendMessage(channelId: number, message: string) {
    const db = await getDb();
    const [channel] = await db.select().from(schema.channels).where({ id: channelId } as any).limit(1);
    if (!channel) return;
    const phone = (channel.config as any)?.phone;
    if (!phone) return;

    const chunks = splitSms(message);
    for (const chunk of chunks) {
      await twilioSend(phone, chunk);
    }

    await db.insert(schema.channel_messages).values({ channel_id: channelId, direction: 'outbound', content: message });
  },

  async handleInbound(raw: any) {
    // Twilio webhook sends form-encoded data
    const from = raw.From || '';
    const body = raw.Body || '';

    const db = await getDb();
    // Find channel by phone number
    const rows = await db.select().from(schema.channels).where({ type: 'sms', is_active: true } as any);
    const channel = rows.find((r) => {
      const phone = (r.config as any)?.phone;
      return phone && (phone === from || from.endsWith(phone.replace(/^\+/, '')));
    });

    if (!channel) {
      // Unknown sender — can't process without pairing
      return { userId: 0, text: body };
    }

    const reply = await processChannelMessage(channel.id, channel.user_id, body, 'sms');

    // Send reply via Twilio
    const chunks = splitSms(reply);
    for (const chunk of chunks) {
      await twilioSend(from, chunk);
    }

    return { userId: channel.user_id, text: body };
  },
};

export { twilioSend };
