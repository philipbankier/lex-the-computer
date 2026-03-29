import { ToolDefinition } from './types.js';
import { getDb, schema } from '../lib/db.js';

const userId = () => 1;

export const createSpaceRouteTool: ToolDefinition<{ path: string; type: 'page' | 'api'; code?: string; isPublic?: boolean }> = {
  name: 'create_space_route',
  description: 'Create a new Space route (page or API endpoint)',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Route path, e.g. "/" or "/about" or "/api/hello"' },
      type: { type: 'string', enum: ['page', 'api'] },
      code: { type: 'string', description: 'Route code. Pages are React components, APIs return data.' },
      isPublic: { type: 'boolean', description: 'Whether the route is publicly accessible (APIs are always public)' },
    },
    required: ['path', 'type'],
  },
  async execute({ path: routePath, type, code, isPublic }) {
    const db = await getDb();
    const is_public = type === 'api' ? true : !!isPublic;
    const defaultCode = type === 'api'
      ? `return { message: "Hello from ${routePath}" };`
      : `function Page() {\n  return (\n    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">\n      <h1 className="text-4xl font-bold">My Page</h1>\n    </div>\n  );\n}`;
    const finalCode = code || defaultCode;
    const [row] = await db.insert(schema.space_routes)
      .values({ user_id: userId(), path: routePath, type, code: finalCode, is_public } as any)
      .returning();
    await db.insert(schema.space_route_versions)
      .values({ route_id: row.id, code: finalCode, version: 1 } as any);
    return { ok: true, route: row };
  },
};

export const editSpaceRouteTool: ToolDefinition<{ id?: number; path?: string; newCode: string }> = {
  name: 'edit_space_route',
  description: 'Update the code of a Space route by id or path',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      path: { type: 'string' },
      newCode: { type: 'string' },
    },
    required: ['newCode'],
  },
  async execute({ id, path: routePath, newCode }) {
    const db = await getDb();
    const route = await findRoute(db, id, routePath);
    if (!route) return { error: 'route not found' };
    const versions = await db.select().from(schema.space_route_versions).where({ route_id: route.id } as any);
    const maxV = versions.reduce((m, v) => Math.max(m, v.version), 0);
    await db.insert(schema.space_route_versions)
      .values({ route_id: route.id, code: newCode, version: maxV + 1 } as any);
    const [row] = await db.update(schema.space_routes)
      .set({ code: newCode, updated_at: new Date() } as any)
      .where({ id: route.id } as any).returning();
    return { ok: true, route: row };
  },
};

export const deleteSpaceRouteTool: ToolDefinition<{ id?: number; path?: string }> = {
  name: 'delete_space_route',
  description: 'Delete a Space route by id or path',
  parameters: {
    type: 'object',
    properties: { id: { type: 'number' }, path: { type: 'string' } },
  },
  async execute({ id, path: routePath }) {
    const db = await getDb();
    const route = await findRoute(db, id, routePath);
    if (!route) return { error: 'route not found' };
    await db.delete(schema.space_route_versions).where({ route_id: route.id } as any);
    await db.delete(schema.space_errors).where({ route_id: route.id } as any);
    await db.delete(schema.space_routes).where({ id: route.id } as any);
    return { ok: true };
  },
};

export const listSpaceRoutesTool: ToolDefinition<{}> = {
  name: 'list_space_routes',
  description: 'List all Space routes for the current user',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const db = await getDb();
    const rows = await db.select().from(schema.space_routes).where({ user_id: userId() } as any);
    return { routes: rows };
  },
};

export const getSpaceRouteTool: ToolDefinition<{ id?: number; path?: string }> = {
  name: 'get_space_route',
  description: 'Get a Space route with its code by id or path',
  parameters: {
    type: 'object',
    properties: { id: { type: 'number' }, path: { type: 'string' } },
  },
  async execute({ id, path: routePath }) {
    const db = await getDb();
    const route = await findRoute(db, id, routePath);
    if (!route) return { error: 'route not found' };
    return { route };
  },
};

export const getSpaceRouteHistoryTool: ToolDefinition<{ id?: number; path?: string }> = {
  name: 'get_space_route_history',
  description: 'Get version history for a Space route',
  parameters: {
    type: 'object',
    properties: { id: { type: 'number' }, path: { type: 'string' } },
  },
  async execute({ id, path: routePath }) {
    const db = await getDb();
    const route = await findRoute(db, id, routePath);
    if (!route) return { error: 'route not found' };
    const versions = await db.select().from(schema.space_route_versions).where({ route_id: route.id } as any);
    versions.sort((a, b) => a.version - b.version);
    return { versions };
  },
};

export const undoSpaceRouteTool: ToolDefinition<{ id?: number; path?: string }> = {
  name: 'undo_space_route',
  description: 'Undo the last code change on a Space route (revert to previous version)',
  parameters: {
    type: 'object',
    properties: { id: { type: 'number' }, path: { type: 'string' } },
  },
  async execute({ id, path: routePath }) {
    const db = await getDb();
    const route = await findRoute(db, id, routePath);
    if (!route) return { error: 'route not found' };
    const versions = await db.select().from(schema.space_route_versions).where({ route_id: route.id } as any);
    versions.sort((a, b) => a.version - b.version);
    const idx = versions.findIndex((v) => v.code === route.code);
    if (idx <= 0) return { error: 'nothing to undo' };
    const prev = versions[idx - 1];
    const [row] = await db.update(schema.space_routes)
      .set({ code: prev.code, updated_at: new Date() } as any)
      .where({ id: route.id } as any).returning();
    return { ok: true, route: row };
  },
};

export const redoSpaceRouteTool: ToolDefinition<{ id?: number; path?: string }> = {
  name: 'redo_space_route',
  description: 'Redo a previously undone code change on a Space route',
  parameters: {
    type: 'object',
    properties: { id: { type: 'number' }, path: { type: 'string' } },
  },
  async execute({ id, path: routePath }) {
    const db = await getDb();
    const route = await findRoute(db, id, routePath);
    if (!route) return { error: 'route not found' };
    const versions = await db.select().from(schema.space_route_versions).where({ route_id: route.id } as any);
    versions.sort((a, b) => a.version - b.version);
    const idx = versions.findIndex((v) => v.code === route.code);
    if (idx < 0 || idx >= versions.length - 1) return { error: 'nothing to redo' };
    const next = versions[idx + 1];
    const [row] = await db.update(schema.space_routes)
      .set({ code: next.code, updated_at: new Date() } as any)
      .where({ id: route.id } as any).returning();
    return { ok: true, route: row };
  },
};

export const uploadSpaceAssetTool: ToolDefinition<{ filename: string; content: string }> = {
  name: 'upload_space_asset',
  description: 'Upload an asset to Space (provide base64-encoded content)',
  parameters: {
    type: 'object',
    properties: {
      filename: { type: 'string' },
      content: { type: 'string', description: 'Base64-encoded file content' },
    },
    required: ['filename', 'content'],
  },
  async execute({ filename, content }) {
    const { default: fs } = await import('node:fs/promises');
    const { default: path } = await import('node:path');
    const { env } = await import('../lib/env.js');
    const db = await getDb();
    const dir = path.join(env.WORKSPACE_DIR, 'space-assets');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    const buffer = Buffer.from(content, 'base64');
    await fs.writeFile(filePath, buffer);
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.css': 'text/css', '.js': 'application/javascript' };
    const [row] = await db.insert(schema.space_assets)
      .values({ user_id: userId(), filename, path: filePath, mime_type: mimeMap[ext] || 'application/octet-stream', size: buffer.length } as any)
      .returning();
    return { ok: true, asset: row };
  },
};

export const deleteSpaceAssetTool: ToolDefinition<{ id?: number; filename?: string }> = {
  name: 'delete_space_asset',
  description: 'Delete a Space asset by id or filename',
  parameters: {
    type: 'object',
    properties: { id: { type: 'number' }, filename: { type: 'string' } },
  },
  async execute({ id, filename }) {
    const { default: fs } = await import('node:fs/promises');
    const db = await getDb();
    let asset: any;
    if (id) {
      asset = (await db.select().from(schema.space_assets).where({ id } as any).limit(1))[0];
    } else if (filename) {
      const all = await db.select().from(schema.space_assets).where({ user_id: userId() } as any);
      asset = all.find((a) => a.filename === filename);
    }
    if (!asset) return { error: 'asset not found' };
    try { await fs.unlink(asset.path); } catch {}
    await db.delete(schema.space_assets).where({ id: asset.id } as any);
    return { ok: true };
  },
};

export const listSpaceAssetsTool: ToolDefinition<{}> = {
  name: 'list_space_assets',
  description: 'List all Space assets',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const db = await getDb();
    const rows = await db.select().from(schema.space_assets).where({ user_id: userId() } as any);
    return { assets: rows };
  },
};

export const getSpaceErrorsTool: ToolDefinition<{}> = {
  name: 'get_space_errors',
  description: 'Get recent Space route errors',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const db = await getDb();
    const rows = await db.select().from(schema.space_errors).limit(50);
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { errors: rows };
  },
};

export const getSpaceSettingsTool: ToolDefinition<{}> = {
  name: 'get_space_settings',
  description: 'Get Space settings (handle, title, description, etc.)',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const db = await getDb();
    const row = (await db.select().from(schema.space_settings).where({ user_id: userId() } as any).limit(1))[0];
    return { settings: row || { handle: '', title: '', description: '', favicon: '', custom_css: '' } };
  },
};

export const updateSpaceSettingsTool: ToolDefinition<{ handle?: string; title?: string; description?: string; favicon?: string; custom_css?: string }> = {
  name: 'update_space_settings',
  description: 'Update Space settings (handle, title, description, custom CSS)',
  parameters: {
    type: 'object',
    properties: {
      handle: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      favicon: { type: 'string' },
      custom_css: { type: 'string' },
    },
  },
  async execute(args) {
    const db = await getDb();
    const uid = userId();
    const existing = (await db.select().from(schema.space_settings).where({ user_id: uid } as any).limit(1))[0];
    const data: any = { updated_at: new Date() };
    for (const k of ['handle', 'title', 'description', 'favicon', 'custom_css'] as const) {
      if (k in args && args[k] !== undefined) data[k] = args[k];
    }
    if (existing) {
      const [row] = await db.update(schema.space_settings).set(data).where({ id: existing.id } as any).returning();
      return { ok: true, settings: row };
    }
    const [row] = await db.insert(schema.space_settings)
      .values({ user_id: uid, handle: data.handle || '', ...data } as any)
      .returning();
    return { ok: true, settings: row };
  },
};

export const restartSpaceServerTool: ToolDefinition<{}> = {
  name: 'restart_space_server',
  description: 'Restart the Space serving process (clears cached state)',
  parameters: { type: 'object', properties: {} },
  async execute() {
    // Space routes are served dynamically from DB, no process to restart.
    // This tool exists for compatibility — it simply confirms the server is ready.
    return { ok: true, message: 'Space routes are served dynamically. No restart needed.' };
  },
};

// ── Helper ──

async function findRoute(db: any, id?: number, routePath?: string) {
  if (id) {
    return (await db.select().from(schema.space_routes).where({ id } as any).limit(1))[0] || null;
  }
  if (routePath) {
    const all = await db.select().from(schema.space_routes).where({ user_id: userId() } as any);
    return all.find((r: any) => r.path === routePath) || null;
  }
  return null;
}
