import { getDb, schema } from '../lib/db.js';
import { buildSystemPrompt } from './prompt.js';
import { chatCompletion, type ChatMessage, type ToolSpec } from '../lib/litellm.js';
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
import {
  createSpaceRouteTool, editSpaceRouteTool, deleteSpaceRouteTool, listSpaceRoutesTool,
  getSpaceRouteTool, getSpaceRouteHistoryTool, undoSpaceRouteTool, redoSpaceRouteTool,
  uploadSpaceAssetTool, deleteSpaceAssetTool, listSpaceAssetsTool,
  getSpaceErrorsTool, getSpaceSettingsTool, updateSpaceSettingsTool, restartSpaceServerTool,
} from '../tools/space_tools.js';
import { getChannel } from './channels/index.js';

const toolDefs = [
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
  createSpaceRouteTool,
  editSpaceRouteTool,
  deleteSpaceRouteTool,
  listSpaceRoutesTool,
  getSpaceRouteTool,
  getSpaceRouteHistoryTool,
  undoSpaceRouteTool,
  redoSpaceRouteTool,
  uploadSpaceAssetTool,
  deleteSpaceAssetTool,
  listSpaceAssetsTool,
  getSpaceErrorsTool,
  getSpaceSettingsTool,
  updateSpaceSettingsTool,
  restartSpaceServerTool,
];

export async function runAutomation(automationId: number) {
  const db = await getDb();
  const automation = (await db.select().from(schema.automations).where({ id: automationId } as any).limit(1))[0];
  if (!automation) return;

  // Create run record
  const [run] = await db
    .insert(schema.automation_runs)
    .values({ automation_id: automationId, status: 'running', started_at: new Date() } as any)
    .returning();

  try {
    const userId = automation.user_id;
    const systemPrompt = await buildSystemPrompt(userId, {
      // No persona override in schema for now
      tools: toolDefs.map((t) => ({ name: t.name, description: t.description })),
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: automation.instruction || '' },
    ];
    const toolSpecs: ToolSpec[] = toolDefs.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

    // Simple function-calling loop
    let output = '';
    let loop = 0;
    while (loop < 5) {
      loop++;
      const resp = await chatCompletion({ model: automation.model || 'gpt-4o-mini', messages, tools: toolSpecs, tool_choice: 'auto' });
      const choice = resp?.choices?.[0];
      const msg = choice?.message || {};
      const content = msg.content || '';
      const toolCalls = msg.tool_calls || msg.toolCalls || null;
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length) {
        // Execute tool calls sequentially and push tool results
        for (const call of toolCalls) {
          const fnName = call.function?.name || call.name;
          const argsRaw = call.function?.arguments || call.arguments || '{}';
          let args: any = {};
          try { args = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw; } catch {}
          const tool = toolDefs.find((t) => t.name === fnName);
          if (!tool) {
            messages.push({ role: 'tool', name: fnName, tool_call_id: call.id || undefined, content: `Tool not found: ${fnName}` });
            continue;
          }
          try {
            const result = await tool.execute(args);
            messages.push({ role: 'tool', name: fnName, tool_call_id: call.id || undefined, content: JSON.stringify(result) });
          } catch (err: any) {
            messages.push({ role: 'tool', name: fnName, tool_call_id: call.id || undefined, content: `Error: ${String(err?.message || err)}` });
          }
        }
        // Continue the loop for model to use tool results
        continue;
      }
      // No tools; take content as final
      output = content;
      break;
    }

    // Save output and mark success
    await db
      .update(schema.automation_runs)
      .set({ status: 'success', output, completed_at: new Date() } as any)
      .where({ id: run.id } as any);

    // Deliver to chat: create a conversation and add assistant message
    const [conv] = await db
      .insert(schema.conversations)
      .values({ user_id: userId, title: automation.name || 'Automation Run', model: automation.model || 'gpt-4o-mini', persona_id: null } as any)
      .returning();
    await db.insert(schema.messages).values({ conversation_id: conv.id, role: 'assistant', content: output, model: automation.model || 'gpt-4o-mini' } as any);

    // Phase 8: Deliver via channels based on delivery field
    // delivery can be: 'chat', 'email', 'telegram', 'discord', 'sms', or comma-separated
    const deliveryMethods = (automation.delivery || 'chat').split(',').map((d: string) => d.trim());
    for (const method of deliveryMethods) {
      if (method === 'chat') continue; // Already delivered above
      try {
        const plugin = getChannel(method);
        if (!plugin || !plugin.isConfigured()) continue;
        // Find user's channel for this type
        const userChannels = await db.select().from(schema.channels)
          .where({ user_id: userId, type: method, is_active: true } as any);
        for (const ch of userChannels) {
          await plugin.sendMessage(ch.id, `[${automation.name}]\n\n${output}`);
        }
      } catch (err: any) {
        console.error(`Automation delivery via ${method} failed:`, err?.message);
      }
    }

    // Update last_run
    await db.update(schema.automations).set({ last_run: new Date() } as any).where({ id: automationId } as any);
  } catch (err: any) {
    await db
      .update(schema.automation_runs)
      .set({ status: 'error', error: String(err?.message || err), completed_at: new Date() } as any)
      .where({ id: run.id } as any);
  }
}

