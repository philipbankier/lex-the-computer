import { getDb, schema } from '../../lib/db.js';
import { buildSystemPrompt } from '../prompt.js';
import { chatCompletion, type ChatMessage, type ToolSpec } from '../../lib/litellm.js';

// ─── Channel Plugin Interface ───────────────────────────────────────
export interface ChannelPlugin {
  type: string;
  isConfigured(): boolean;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  sendMessage(channelId: number, message: string, attachments?: Buffer[]): Promise<void>;
  handleInbound(raw: any): Promise<{ userId: number; text: string; attachments?: any[] }>;
}

// ─── Channel Registry ───────────────────────────────────────────────
const plugins = new Map<string, ChannelPlugin>();

export function registerChannel(plugin: ChannelPlugin) {
  plugins.set(plugin.type, plugin);
}

export function getChannel(type: string): ChannelPlugin | undefined {
  return plugins.get(type);
}

export function getAllChannels(): ChannelPlugin[] {
  return Array.from(plugins.values());
}

export function getConfiguredChannelTypes(): string[] {
  return Array.from(plugins.entries())
    .filter(([, p]) => p.isConfigured())
    .map(([t]) => t);
}

// ─── Pairing Code Management ────────────────────────────────────────
const pairingCodes = new Map<string, { userId: number; type: string; expiresAt: number }>();

export function generatePairingCode(userId: number, type: string): string {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  pairingCodes.set(code, { userId, type, expiresAt: Date.now() + 10 * 60 * 1000 }); // 10 min
  return code;
}

export function validatePairingCode(code: string, type: string): number | null {
  const entry = pairingCodes.get(code.toUpperCase());
  if (!entry || entry.type !== type || entry.expiresAt < Date.now()) return null;
  pairingCodes.delete(code.toUpperCase());
  return entry.userId;
}

// ─── Shared: Process inbound message through AI ─────────────────────
export async function processChannelMessage(
  channelId: number,
  userId: number,
  text: string,
  channelType: string,
): Promise<string> {
  const db = await getDb();

  // Find channel record for persona
  const [channel] = await db.select().from(schema.channels).where({ id: channelId } as any).limit(1);
  const personaId = channel?.persona_id ?? undefined;

  // Find or create conversation for this channel
  // Use a convention: title = `[channel-type] Channel Conversation`
  let convRows = await db.select().from(schema.conversations)
    .where({ user_id: userId } as any).limit(100);
  // Find existing channel conversation
  const channelTitle = `[${channelType}] Channel`;
  let conv = convRows.find((c) => c.title === channelTitle);
  if (!conv) {
    const [newConv] = await db.insert(schema.conversations)
      .values({ user_id: userId, title: channelTitle, model: 'gpt-4o-mini', persona_id: personaId ?? null })
      .returning();
    conv = newConv;
  }

  // Save inbound user message
  await db.insert(schema.messages)
    .values({ conversation_id: conv.id, role: 'user', content: text, model: null });

  // Log inbound
  await db.insert(schema.channel_messages)
    .values({ channel_id: channelId, direction: 'inbound', content: text, conversation_id: conv.id });

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(userId, { personaId, tools: [] });

  // Fetch last N messages for context
  const history = await db.select().from(schema.messages)
    .where({ conversation_id: conv.id } as any).limit(20);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role as any, content: m.content })),
  ];

  // Get AI response (non-streaming for channel delivery)
  const resp = await chatCompletion({
    model: conv.model || 'gpt-4o-mini',
    messages,
  });
  const reply = resp?.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

  // Save assistant message
  await db.insert(schema.messages)
    .values({ conversation_id: conv.id, role: 'assistant', content: reply, model: conv.model || 'gpt-4o-mini' });

  // Log outbound
  await db.insert(schema.channel_messages)
    .values({ channel_id: channelId, direction: 'outbound', content: reply, conversation_id: conv.id });

  // Update conversation timestamp
  await db.update(schema.conversations).set({ updated_at: new Date() } as any).where({ id: conv.id } as any);

  return reply;
}

// ─── Initialize all configured channels ─────────────────────────────
export async function initializeChannels(): Promise<void> {
  for (const plugin of plugins.values()) {
    if (plugin.isConfigured()) {
      try {
        await plugin.initialize();
        console.log(`Channel initialized: ${plugin.type}`);
      } catch (err: any) {
        console.error(`Failed to initialize channel ${plugin.type}:`, err?.message || err);
      }
    }
  }
}

export async function shutdownChannels(): Promise<void> {
  for (const plugin of plugins.values()) {
    try {
      await plugin.shutdown();
    } catch {}
  }
}
