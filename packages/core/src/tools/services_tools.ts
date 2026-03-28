import { ToolDefinition } from './types.js';
import { getDb, schema } from '../lib/db.js';
import { startService, stopService } from '../services/service-runner.js';

export const registerServiceTool: ToolDefinition<{ name: string; type: 'http'|'tcp'; port?: number; entrypoint?: string; working_dir?: string; env_vars?: any }> = {
  name: 'register_service',
  description: 'Register a new service with entrypoint and optional port',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['http','tcp'] },
      port: { type: 'number' },
      entrypoint: { type: 'string' },
      working_dir: { type: 'string' },
      env_vars: { type: 'object' }
    },
    required: ['name','type']
  },
  async execute(args) {
    const db = await getDb();
    const user_id = 1;
    const [row] = await db.insert(schema.services).values({ user_id, ...args, is_running: false } as any).returning();
    return { ok: true, service: row };
  }
};

export const updateServiceTool: ToolDefinition<{ id: number; name?: string; type?: 'http'|'tcp'; port?: number; entrypoint?: string; working_dir?: string; env_vars?: any }> = {
  name: 'update_service',
  description: 'Update a service configuration',
  parameters: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' }, type: { type: 'string' }, port: { type: 'number' }, entrypoint: { type: 'string' }, working_dir: { type: 'string' }, env_vars: { type: 'object' } }, required: ['id'] },
  async execute({ id, ...updates }) {
    const db = await getDb();
    const [row] = await db.update(schema.services).set(updates as any).where({ id } as any).returning();
    return { ok: true, service: row };
  }
};

export const deleteServiceTool: ToolDefinition<{ id: number }> = {
  name: 'delete_service',
  description: 'Delete a service by id (stops it first)',
  parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
  async execute({ id }) {
    await stopService(id).catch(() => ({}));
    const db = await getDb();
    await db.delete(schema.services).where({ id } as any);
    return { ok: true };
  }
};

export const listServicesTool: ToolDefinition<{}> = {
  name: 'list_services',
  description: 'List all services for the current user',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const db = await getDb();
    const user_id = 1;
    const rows = await db.select().from(schema.services).where({ user_id } as any);
    return { services: rows };
  }
};

