import { getDb, schema } from '../lib/db.js';
import type { ToolDefinition } from './types.js';

export const listAgentsTool: ToolDefinition = {
  name: 'list_agents',
  description: 'List all agents for the current user',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const db = await getDb();
    const rows = await db.select().from(schema.agents).where({ user_id: 1 } as any).limit(100);
    return rows;
  },
};
