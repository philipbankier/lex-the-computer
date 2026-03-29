import { env } from '../../lib/env.js';
import { getDb, schema } from '../../lib/db.js';
import type { ChannelPlugin } from './base.js';
import { processChannelMessage } from './base.js';

// ─── Email Provider Adapters ────────────────────────────────────────

interface EmailProvider {
  send(to: string, subject: string, body: string, replyTo?: string, references?: string): Promise<void>;
}

function getEmailProvider(): EmailProvider | null {
  switch (env.EMAIL_PROVIDER) {
    case 'cloudflare': return cloudflareProvider();
    case 'postal': return postalProvider();
    case 'mailgun': return mailgunProvider();
    default: return null;
  }
}

function cloudflareProvider(): EmailProvider {
  // Cloudflare Email Workers — send via MailChannels (free tier)
  return {
    async send(to, subject, body, replyTo, references) {
      const fromAddr = `lex@${env.EMAIL_DOMAIN}`;
      // Cloudflare Workers typically use MailChannels API for sending
      const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromAddr, name: 'Lex' },
          subject,
          content: [{ type: 'text/plain', value: body }],
          ...(replyTo ? { reply_to: { email: replyTo } } : {}),
          ...(references ? { headers: { References: references, 'In-Reply-To': references } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`MailChannels send failed: ${res.status}`);
    },
  };
}

function postalProvider(): EmailProvider {
  return {
    async send(to, subject, body, replyTo, references) {
      const apiUrl = env.POSTAL_API_URL || 'https://postal.example.com';
      const res = await fetch(`${apiUrl}/api/v1/send/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Server-API-Key': env.EMAIL_API_KEY,
        },
        body: JSON.stringify({
          to: [to],
          from: `lex@${env.EMAIL_DOMAIN}`,
          subject,
          plain_body: body,
          ...(replyTo ? { reply_to: replyTo } : {}),
          ...(references ? { headers: { References: references, 'In-Reply-To': references } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Postal send failed: ${res.status}`);
    },
  };
}

function mailgunProvider(): EmailProvider {
  return {
    async send(to, subject, body, replyTo, references) {
      const domain = env.MAILGUN_DOMAIN || env.EMAIL_DOMAIN;
      const auth = Buffer.from(`api:${env.EMAIL_API_KEY}`).toString('base64');
      const form = new URLSearchParams();
      form.set('from', `Lex <lex@${env.EMAIL_DOMAIN}>`);
      form.set('to', to);
      form.set('subject', subject);
      form.set('text', body);
      if (replyTo) form.set('h:Reply-To', replyTo);
      if (references) {
        form.set('h:References', references);
        form.set('h:In-Reply-To', references);
      }
      const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Mailgun send failed: ${res.status}`);
    },
  };
}

// ─── Email Channel Plugin ───────────────────────────────────────────

export const emailPlugin: ChannelPlugin = {
  type: 'email',

  isConfigured() {
    return !!(env.EMAIL_PROVIDER && env.EMAIL_DOMAIN);
  },

  async initialize() {
    // Email uses webhooks — no persistent connection needed.
    // Webhook route is registered in the channels route file.
    console.log(`Email channel ready: *@${env.EMAIL_DOMAIN} via ${env.EMAIL_PROVIDER}`);
  },

  async shutdown() {
    // Nothing to clean up
  },

  async sendMessage(channelId: number, message: string) {
    const provider = getEmailProvider();
    if (!provider) throw new Error('Email provider not configured');

    const db = await getDb();
    const [channel] = await db.select().from(schema.channels).where({ id: channelId } as any).limit(1);
    if (!channel) return;

    const config = channel.config as any;
    const toEmail = config?.email;
    if (!toEmail) return;

    await provider.send(toEmail, 'Message from Lex', message, `lex@${env.EMAIL_DOMAIN}`);

    await db.insert(schema.channel_messages).values({ channel_id: channelId, direction: 'outbound', content: message });
  },

  async handleInbound(raw: any) {
    // Parse webhook payload — format depends on provider
    const from = raw.from || raw.sender || raw.envelope?.from || '';
    const subject = raw.subject || '';
    const body = raw.text || raw.plain_body || raw['body-plain'] || raw.body || '';
    const to = raw.to || raw.recipient || raw.envelope?.to?.[0] || '';
    const messageId = raw.message_id || raw['Message-Id'] || '';

    // Find user by email handle
    const handle = to.split('@')[0];
    const db = await getDb();
    const users = await db.select().from(schema.users).limit(100);
    const user = users.find((u) => u.handle === handle || u.email === to) || users[0]; // fallback to first user in single-user mode
    if (!user) throw new Error(`No user found for email: ${to}`);

    // Find or create email channel for this user+sender
    let channels = await db.select().from(schema.channels)
      .where({ user_id: user.id, type: 'email', is_active: true } as any);
    let channel = channels.find((c) => (c.config as any)?.email === from);
    if (!channel) {
      const [newCh] = await db.insert(schema.channels).values({
        user_id: user.id,
        type: 'email',
        config: { email: from, last_subject: subject, message_id: messageId },
        is_active: true,
      }).returning();
      channel = newCh;
    }

    // Process through AI
    const text = subject ? `Subject: ${subject}\n\n${body}` : body;
    const reply = await processChannelMessage(channel.id, user.id, text, 'email');

    // Send reply email
    const provider = getEmailProvider();
    if (provider) {
      await provider.send(from, `Re: ${subject || 'Your message'}`, reply, `lex@${env.EMAIL_DOMAIN}`, messageId);
    }

    return { userId: user.id, text };
  },
};
