import { getDb, schema } from '../lib/db.js';
import type { ToolDefinition } from './types.js';
import { removeAutomationSchedule } from '../lib/queue.js';

export const deleteAutomationTool: ToolDefinition<{ id: number }> = {
  name: 'delete_automation',
  description: 'Delete an automation by id',
  parameters: {
    type: 'object',
    properties: { id: { type: 'integer' } },
    required: ['id'],
  },
  async execute(params) {
    const db = await getDb();
    await removeAutomationSchedule(params.id);
    await db.delete(schema.automation_runs).where({ automation_id: params.id } as any);
    await db.delete(schema.automations).where({ id: params.id } as any);
    return { ok: true };
  },
};

