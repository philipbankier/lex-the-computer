import { getDb, schema } from '../lib/db.js';
import type { ToolDefinition } from './types.js';
import { removeAgentSchedule } from '../lib/queue.js';

export const deleteAgentTool: ToolDefinition<{ id: number }> = {
  name: 'delete_agent',
  description: 'Delete an agent by id',
  parameters: {
    type: 'object',
    properties: { id: { type: 'integer' } },
    required: ['id'],
  },
  async execute(params) {
    const db = await getDb();
    await removeAgentSchedule(params.id);
    await db.delete(schema.agent_runs).where({ agent_id: params.id } as any);
    await db.delete(schema.agents).where({ id: params.id } as any);
    return { ok: true };
  },
};
