import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getDb, schema } from '../lib/db.js';
import { buildSystemPrompt } from '../services/prompt.js';
import { streamChat, type ChatMessage, type ToolSpec } from '../lib/litellm.js';
import { webSearch } from '../tools/web_search.js';
import { readWebpage } from '../tools/read_webpage.js';
import { saveWebpage } from '../tools/save_webpage.js';
import { createFile } from '../tools/create_file.js';
import { editFile } from '../tools/edit_file.js';
import { listFilesTool } from '../tools/list_files.js';
import { searchFilesTool } from '../tools/search_files.js';
import { runCommand } from '../tools/run_command.js';
import { runSequentialCommands } from '../tools/run_sequential_commands.js';
import { runParallelCommands } from '../tools/run_parallel_commands.js';
import { createAutomationTool } from '../tools/create_automation.js';
import { editAutomationTool } from '../tools/edit_automation.js';
import { deleteAutomationTool } from '../tools/delete_automation.js';
import { listAutomationsTool } from '../tools/list_automations.js';

export const chatRouter = new Hono();

// Utilities
const asInt = (v: string) => Number.parseInt(v, 10);
const userIdFromCtx = () => 1; // Phase 0 placeholder auth

// Conversations CRUD
chatRouter.post('/conversations', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const body = await c.req.json().catch(() => ({}));
  const model = body.model || 'gpt-4o-mini';
  const persona_id = body.persona_id ?? null;
  const [row] = await db
    .insert(schema.conversations)
    .values({ user_id: userId, title: body.title || null, model, persona_id })
    .returning();
  return c.json(row);
});

chatRouter.get('/conversations', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  // basic list; omit order for typing simplicity
  const rows = await db.select().from(schema.conversations).where({ user_id: userId } as any).limit(50);
  return c.json(rows);
});

chatRouter.get('/conversations/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const convo = (await db.select().from(schema.conversations).where({ id } as any).limit(1))[0];
  if (!convo) return c.json({ error: 'Not found' }, 404);
  const msgs = await db.select().from(schema.messages).where({ conversation_id: id } as any);
  return c.json({ conversation: convo, messages: msgs });
});

chatRouter.patch('/conversations/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json();
  const [row] = await db.update(schema.conversations).set({ title: body.title, updated_at: new Date() } as any).where({ id } as any).returning();
  return c.json(row);
});

chatRouter.delete('/conversations/:id', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  await db.delete(schema.messages).where({ conversation_id: id } as any);
  await db.delete(schema.conversations).where({ id } as any);
  return c.json({ ok: true });
});

chatRouter.post('/conversations/:id/title', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const title = (body.suggested_title as string) || 'New Chat';
  const [row] = await db.update(schema.conversations).set({ title, updated_at: new Date() } as any).where({ id } as any).returning();
  return c.json(row);
});

// Send message + stream AI response
chatRouter.post('/conversations/:id/messages', async (c) => {
  const db = await getDb();
  const id = asInt(c.req.param('id'));
  const body = await c.req.json();
  const userId = userIdFromCtx();
  const convo = (await db.select().from(schema.conversations).where({ id } as any).limit(1))[0];
  if (!convo) return c.json({ error: 'Not found' }, 404);

  const content: string = body.content || '';
  const model = body.model || convo.model || 'gpt-4o-mini';
  const fileSnippets: string[] = Array.isArray(body.fileSnippets) ? body.fileSnippets : [];
  const toolsList = [
    webSearch,
    readWebpage,
    saveWebpage,
    createFile,
    editFile,
    listFilesTool,
    searchFilesTool,
    runCommand,
    runSequentialCommands,
    runParallelCommands,
    // Automations tools
    createAutomationTool,
    editAutomationTool,
    deleteAutomationTool,
    listAutomationsTool,
  ];

  // persist user message
  const [userMsg] = await db
    .insert(schema.messages)
    .values({ conversation_id: id, role: 'user', content, model: null })
    .returning();

  const systemPrompt = await buildSystemPrompt(userId, {
    personaId: convo.persona_id ?? undefined,
    tools: toolsList.map((t) => ({ name: t.name, description: t.description })),
    fileSnippets,
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];

  const toolSpecs: ToolSpec[] = toolsList.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: 'start', data: JSON.stringify({ model }) });
    let acc = '';
    await streamChat({ model, messages, tools: toolSpecs, tool_choice: 'auto' }, async (chunk) => {
      // naive pass-through of SSE text chunks
      acc += chunk;
      await stream.writeSSE({ event: 'token', data: chunk });
    });
    // save assistant message
    const [assistantMsg] = await db
      .insert(schema.messages)
      .values({ conversation_id: id, role: 'assistant', content: acc, model })
      .returning();
    await db.update(schema.conversations).set({ updated_at: new Date(), model } as any).where({ id } as any);
    await stream.writeSSE({ event: 'end', data: JSON.stringify({ messageId: assistantMsg.id }) });
    await stream.close();
  });
});
