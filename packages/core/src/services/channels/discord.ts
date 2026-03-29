import { env } from '../../lib/env.js';
import { getDb, schema } from '../../lib/db.js';
import type { ChannelPlugin } from './base.js';
import { validatePairingCode, processChannelMessage } from './base.js';

let client: any = null;

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

export const discordPlugin: ChannelPlugin = {
  type: 'discord',

  isConfigured() {
    return !!(env.DISCORD_BOT_TOKEN && env.DISCORD_APPLICATION_ID);
  },

  async initialize() {
    const discord = await import('discord.js');
    const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = discord;

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);
    const commands = [
      new SlashCommandBuilder().setName('new').setDescription('Start a new conversation'),
      new SlashCommandBuilder().setName('persona').setDescription('Switch persona')
        .addStringOption((opt: any) => opt.setName('name').setDescription('Persona name').setRequired(false)),
    ];
    try {
      await rest.put(Routes.applicationCommands(env.DISCORD_APPLICATION_ID), {
        body: commands.map((c: any) => c.toJSON()),
      });
    } catch (err: any) {
      console.error('Discord slash command registration failed:', err?.message);
    }

    client.on('ready', () => {
      console.log(`Discord bot ready as ${client.user?.tag}`);
    });

    // Handle slash commands
    client.on('interactionCreate', async (interaction: any) => {
      if (!interaction.isChatInputCommand()) return;
      const discordUserId = interaction.user.id;
      const channel = await findChannelByDiscordId(discordUserId);

      if (interaction.commandName === 'new') {
        if (!channel) { await interaction.reply('Not paired yet. Send your pairing code as a DM.'); return; }
        const db = await getDb();
        const title = '[discord] Channel';
        await db.delete(schema.conversations).where({ user_id: channel.user_id, title } as any);
        await interaction.reply('New conversation started!');
      }

      if (interaction.commandName === 'persona') {
        if (!channel) { await interaction.reply('Not paired yet.'); return; }
        const db = await getDb();
        const name = interaction.options.getString('name');
        if (!name) {
          const personas = await db.select().from(schema.personas).where({ user_id: channel.user_id } as any);
          const list = personas.map((p) => `- ${p.name}`).join('\n') || 'No personas.';
          await interaction.reply(`Available personas:\n${list}`);
          return;
        }
        const personas = await db.select().from(schema.personas).where({ user_id: channel.user_id } as any);
        const match = personas.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (!match) { await interaction.reply(`Persona "${name}" not found.`); return; }
        await db.update(schema.channels).set({ persona_id: match.id, updated_at: new Date() } as any).where({ id: channel.id } as any);
        await interaction.reply(`Persona switched to: ${match.name}`);
      }
    });

    // Handle DM messages
    client.on('messageCreate', async (message: any) => {
      if (message.author.bot) return;
      // Only handle DMs
      if (message.channel.type !== 1) return; // 1 = DM channel type

      const discordUserId = message.author.id;
      const text = message.content || '';

      // Check pairing code
      if (/^[A-Z0-9]{6}$/.test(text.trim())) {
        const userId = validatePairingCode(text.trim(), 'discord');
        if (userId) {
          const db = await getDb();
          await db.insert(schema.channels).values({
            user_id: userId,
            type: 'discord',
            config: { discord_user_id: discordUserId, username: message.author.username, discriminator: message.author.discriminator || '' },
            is_active: true,
          }).returning();
          await message.reply('Paired successfully! You can now chat with Lex here.');
          return;
        }
      }

      const channel = await findChannelByDiscordId(discordUserId);
      if (!channel) {
        await message.reply('Not paired yet. Get a pairing code from Settings → Channels → Discord in the Lex web app.');
        return;
      }

      try {
        const reply = await processChannelMessage(channel.id, channel.user_id, text, 'discord');
        const chunks = splitMessage(reply, 2000);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } catch (err: any) {
        await message.reply('Sorry, something went wrong.');
        console.error('Discord channel error:', err?.message || err);
      }
    });

    await client.login(env.DISCORD_BOT_TOKEN);
  },

  async shutdown() {
    if (client) {
      client.destroy();
      client = null;
    }
  },

  async sendMessage(channelId: number, message: string) {
    if (!client) return;
    const db = await getDb();
    const [channel] = await db.select().from(schema.channels).where({ id: channelId } as any).limit(1);
    if (!channel) return;
    const discordUserId = (channel.config as any)?.discord_user_id;
    if (!discordUserId) return;

    try {
      const user = await client.users.fetch(discordUserId);
      const dm = await user.createDM();
      const chunks = splitMessage(message, 2000);
      for (const chunk of chunks) {
        await dm.send(chunk);
      }
    } catch (err: any) {
      console.error('Discord send failed:', err?.message);
    }

    await db.insert(schema.channel_messages).values({ channel_id: channelId, direction: 'outbound', content: message });
  },

  async handleInbound() {
    // Handled via client events in initialize()
    return { userId: 0, text: '' };
  },
};

async function findChannelByDiscordId(discordUserId: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.channels).where({ type: 'discord', is_active: true } as any);
  return rows.find((r) => (r.config as any)?.discord_user_id === discordUserId) || null;
}
