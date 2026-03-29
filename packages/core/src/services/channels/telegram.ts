import { env } from '../../lib/env.js';
import { getDb, schema } from '../../lib/db.js';
import type { ChannelPlugin } from './base.js';
import { validatePairingCode, processChannelMessage } from './base.js';

// Grammy types — we dynamically import to avoid hard crash when not installed
let Bot: any;
let botInstance: any = null;

function splitMessage(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) { chunks.push(remaining); break; }
    let splitAt = remaining.lastIndexOf('\n', limit);
    if (splitAt < limit / 2) splitAt = limit;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

export const telegramPlugin: ChannelPlugin = {
  type: 'telegram',

  isConfigured() {
    return !!env.TELEGRAM_BOT_TOKEN;
  },

  async initialize() {
    const grammy = await import('grammy');
    Bot = grammy.Bot;
    botInstance = new Bot(env.TELEGRAM_BOT_TOKEN);

    // /start command
    botInstance.command('start', async (ctx: any) => {
      await ctx.reply(
        'Welcome to Lex! To connect your account, go to Settings → Channels → Telegram in the Lex web app, get a pairing code, and send it here.\n\nOr send any message after pairing to chat with your AI.',
      );
    });

    // /new command — start a new conversation
    botInstance.command('new', async (ctx: any) => {
      const chatId = String(ctx.chat?.id);
      const channel = await findChannelByChatId(chatId);
      if (!channel) { await ctx.reply('Not paired. Send your pairing code first.'); return; }
      // Delete the existing channel conversation so a new one is created
      const db = await getDb();
      const title = '[telegram] Channel';
      await db.delete(schema.conversations).where({ user_id: channel.user_id, title } as any);
      await ctx.reply('New conversation started. Send a message to begin.');
    });

    // /persona command
    botInstance.command('persona', async (ctx: any) => {
      const chatId = String(ctx.chat?.id);
      const channel = await findChannelByChatId(chatId);
      if (!channel) { await ctx.reply('Not paired yet.'); return; }
      const personaName = ctx.match?.trim();
      if (!personaName) {
        const db = await getDb();
        const personas = await db.select().from(schema.personas).where({ user_id: channel.user_id } as any);
        const list = personas.map((p) => `- ${p.name}`).join('\n') || 'No personas created yet.';
        await ctx.reply(`Available personas:\n${list}\n\nUsage: /persona <name>`);
        return;
      }
      const db = await getDb();
      const [persona] = await db.select().from(schema.personas)
        .where({ user_id: channel.user_id } as any).limit(100);
      const allPersonas = await db.select().from(schema.personas).where({ user_id: channel.user_id } as any);
      const match = allPersonas.find((p) => p.name.toLowerCase() === personaName.toLowerCase());
      if (!match) { await ctx.reply(`Persona "${personaName}" not found.`); return; }
      await db.update(schema.channels).set({ persona_id: match.id, updated_at: new Date() } as any).where({ id: channel.id } as any);
      await ctx.reply(`Persona switched to: ${match.name}`);
    });

    // Handle text messages
    botInstance.on('message:text', async (ctx: any) => {
      const chatId = String(ctx.chat?.id);
      const text = ctx.message?.text || '';

      // Check if this is a pairing code
      if (/^[A-Z0-9]{6}$/.test(text.trim())) {
        const userId = validatePairingCode(text.trim(), 'telegram');
        if (userId) {
          const db = await getDb();
          // Create channel connection
          const [ch] = await db.insert(schema.channels).values({
            user_id: userId,
            type: 'telegram',
            config: { chat_id: chatId, username: ctx.from?.username || '', first_name: ctx.from?.first_name || '' },
            is_active: true,
          }).returning();
          await ctx.reply('Paired successfully! You can now chat with your Lex AI here.');
          return;
        }
      }

      // Find paired channel
      const channel = await findChannelByChatId(chatId);
      if (!channel) {
        await ctx.reply('Not paired yet. Get a pairing code from Settings → Channels → Telegram in the Lex web app.');
        return;
      }

      try {
        const reply = await processChannelMessage(channel.id, channel.user_id, text, 'telegram');
        const chunks = splitMessage(reply, 4096);
        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(() => ctx.reply(chunk));
        }
      } catch (err: any) {
        await ctx.reply('Sorry, something went wrong processing your message.');
        console.error('Telegram channel error:', err?.message || err);
      }
    });

    // Handle file/document messages
    botInstance.on('message:document', async (ctx: any) => {
      const chatId = String(ctx.chat?.id);
      const channel = await findChannelByChatId(chatId);
      if (!channel) return;
      const caption = ctx.message?.caption || 'File received';
      try {
        const reply = await processChannelMessage(channel.id, channel.user_id, `[File attached: ${ctx.message?.document?.file_name || 'unknown'}] ${caption}`, 'telegram');
        await ctx.reply(reply);
      } catch {}
    });

    // Start polling
    botInstance.start({ onStart: () => console.log('Telegram bot started') });
  },

  async shutdown() {
    if (botInstance) {
      await botInstance.stop();
      botInstance = null;
    }
  },

  async sendMessage(channelId: number, message: string) {
    if (!botInstance) return;
    const db = await getDb();
    const [channel] = await db.select().from(schema.channels).where({ id: channelId } as any).limit(1);
    if (!channel) return;
    const chatId = (channel.config as any)?.chat_id;
    if (!chatId) return;

    const chunks = splitMessage(message, 4096);
    for (const chunk of chunks) {
      await botInstance.api.sendMessage(chatId, chunk, { parse_mode: 'Markdown' }).catch(() =>
        botInstance.api.sendMessage(chatId, chunk),
      );
    }

    // Log outbound
    await db.insert(schema.channel_messages).values({ channel_id: channelId, direction: 'outbound', content: message });
  },

  async handleInbound() {
    // Handled via bot polling in initialize()
    return { userId: 0, text: '' };
  },
};

async function findChannelByChatId(chatId: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.channels).where({ type: 'telegram', is_active: true } as any);
  return rows.find((r) => (r.config as any)?.chat_id === chatId) || null;
}
