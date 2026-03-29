import { getDb, schema } from '../lib/db.js';
import type { ToolDefinition } from './types.js';
import { scheduleAgent } from '../lib/queue.js';

export const createAgentTool: ToolDefinition<{ name: string; instruction: string; schedule: string; delivery_method?: string; model?: string }> = {
  name: 'create_agent',
  description: 'Create a scheduled agent with name, instruction, and cron schedule',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      instruction: { type: 'string' },
      schedule: { type: 'string', description: 'Cron expression' },
      delivery_method: { type: 'string', enum: ['chat', 'email', 'telegram'] },
      model: { type: 'string' },
    },
    required: ['name', 'instruction', 'schedule'],
  },
  async execute(params) {
    const db = await getDb();
    const [row] = await db
      .insert(schema.agents)
      .values({ user_id: 1, name: params.name, instruction: params.instruction, schedule: params.schedule, delivery: params.delivery_method || 'chat', model: params.model || 'gpt-4o-mini', is_active: true } as any)
      .returning();
    if (row.schedule && row.is_active) await scheduleAgent(row.id, row.schedule);
    return row;
  },
};
