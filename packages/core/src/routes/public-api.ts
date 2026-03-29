import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import { validateApiKey } from './api-keys.js';
import { buildSystemPrompt } from '../services/prompt.js';
import { streamChat, chatCompletion, type ChatMessage, type ToolSpec } from '../lib/litellm.js';

type ApiEnv = { Variables: { userId: number } };
export const publicApiRouter = new Hono<ApiEnv>();

// API key auth middleware
publicApiRouter.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' }, 401);
  }

  const key = authHeader.slice(7);
  const result = await validateApiKey(key);
  if (!result.valid || !result.userId) {
    return c.json({ error: 'Invalid or expired API key' }, 401);
  }

  c.set('userId', result.userId);
  await next();
});

// POST /api/v1/ask — send message, get response
publicApiRouter.post('/ask', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const message = body.message;
  if (!message) return c.json({ error: 'message is required' }, 400);

  const model = body.model_name || 'gpt-4o-mini';
  const personaId = body.persona_id ? Number(body.persona_id) : undefined;
  const outputFormat = body.output_format || 'text';
  const shouldStream = body.stream === true;
  const conversationId = body.conversation_id ? Number(body.conversation_id) : undefined;

  const db = await getDb();

  // Create or get conversation
  let convoId = conversationId;
  if (!convoId) {
    const [convo] = await db.insert(schema.conversations).values({
      user_id: userId,
      title: message.slice(0, 60),
      model,
      persona_id: personaId ?? null,
    } as any).returning();
    convoId = convo.id;
  }

  // Save user message
  await db.insert(schema.messages).values({
    conversation_id: convoId,
    role: 'user',
    content: message,
  } as any);

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(userId, { personaId });

  // Build messages (include recent history if continuing conversation)
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

  if (conversationId) {
    const history = await db.select().from(schema.messages)
      .where(eq(schema.messages.conversation_id, convoId))
      .limit(20);
    for (const m of history) {
      if (m.role === 'system') continue;
      messages.push({ role: m.role as any, content: m.content });
    }
  } else {
    messages.push({ role: 'user', content: message });
  }

  if (outputFormat === 'json') {
    messages[0].content += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences, just pure JSON.';
  }

  // Streaming mode
  if (shouldStream) {
    return streamSSE(c, async (stream) => {
      let acc = '';
      await stream.writeSSE({ event: 'start', data: JSON.stringify({ conversation_id: convoId, model }) });
      await streamChat({ model, messages }, async (chunk) => {
        acc += chunk;
        await stream.writeSSE({ event: 'token', data: chunk });
      });
      // Save assistant message
      const [assistantMsg] = await db.insert(schema.messages).values({
        conversation_id: convoId,
        role: 'assistant',
        content: acc,
        model,
      } as any).returning();
      await stream.writeSSE({ event: 'end', data: JSON.stringify({ conversation_id: convoId, message_id: assistantMsg.id }) });
      await stream.close();
    });
  }

  // Non-streaming mode
  const completion = await chatCompletion({ model, messages });
  const responseContent = completion.choices?.[0]?.message?.content || '';
  const usage = completion.usage || {};

  // Save assistant message
  const [assistantMsg] = await db.insert(schema.messages).values({
    conversation_id: convoId,
    role: 'assistant',
    content: responseContent,
    model,
    tokens_in: usage.prompt_tokens,
    tokens_out: usage.completion_tokens,
  } as any).returning();

  return c.json({
    response: responseContent,
    conversation_id: convoId,
    message_id: assistantMsg.id,
    model,
    usage: {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
    },
  });
});

// GET /api/v1/models/available — list available models
publicApiRouter.get('/models/available', async (c) => {
  const { env: envConfig } = await import('../lib/env.js');
  try {
    const res = await fetch(`${envConfig.LITELLM_BASE_URL.replace(/\/$/, '')}/v1/models`);
    if (!res.ok) return c.json({ data: [] });
    const json = await res.json();
    return c.json(json);
  } catch {
    return c.json({ data: [] });
  }
});

// GET /api/v1/personas/available — list personas
publicApiRouter.get('/personas/available', async (c) => {
  const userId = c.get('userId');
  const db = await getDb();
  const rows = await db.select().from(schema.personas).where(eq(schema.personas.user_id, userId));
  return c.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    is_default: r.is_default,
  })));
});

// GET /api/v1/conversations/:id — get conversation history
publicApiRouter.get('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const db = await getDb();
  const id = Number(c.req.param('id'));

  const [convo] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id)).limit(1);
  if (!convo || convo.user_id !== userId) return c.json({ error: 'Not found' }, 404);

  const msgs = await db.select().from(schema.messages).where(eq(schema.messages.conversation_id, id));
  return c.json({
    conversation: { id: convo.id, title: convo.title, model: convo.model, created_at: convo.created_at },
    messages: msgs.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      created_at: m.created_at,
    })),
  });
});
