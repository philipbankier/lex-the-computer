import { getDb, schema } from '../lib/db.js';
import type { ToolDefinition } from './types.js';
import { removeAgentSchedule, scheduleAgent } from '../lib/queue.js';

export const editAgentTool: ToolDefinition<{ id: number; name?: string; instruction?: string; schedule?: string; delivery_method?: string; model?: string; is_active?: boolean }> = {
  name: 'edit_agent',
  description: 'Edit an existing agent by id',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      instruction: { type: 'string' },
      schedule: { type: 'string' },
      delivery_method: { type: 'string' },
      model: { type: 'string' },
      is_active: { type: 'boolean' },
    },
    required: ['id'],
  },
  async execute(params) {
    const db = await getDb();
    const partial: any = {};
    if (params.name !== undefined) partial.name = params.name;
    if (params.instruction !== undefined) partial.instruction = params.instruction;
    if (params.schedule !== undefined) partial.schedule = params.schedule;
    if (params.delivery_method !== undefined) partial.delivery = params.delivery_method;
    if (params.model !== undefined) partial.model = params.model;
    if (params.is_active !== undefined) partial.is_active = params.is_active;
    const [row] = await db.update(schema.agents).set(partial as any).where({ id: params.id } as any).returning();
    await removeAgentSchedule(params.id);
    if (row?.schedule && row?.is_active) await scheduleAgent(params.id, row.schedule);
    return row;
  },
};
