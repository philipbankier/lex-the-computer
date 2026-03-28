import { ToolDefinition } from './types.js';
import { getDb, schema } from '../lib/db.js';
import { startSite, stopSite } from '../services/site-runner.js';

export const publishSiteTool: ToolDefinition<{ id?: number; slug?: string }> = {
  name: 'publish_site',
  description: 'Publish and start a site by id or slug',
  parameters: { type: 'object', properties: { id: { type: 'number' }, slug: { type: 'string' } } },
  async execute({ id, slug }) {
    const db = await getDb();
    let siteId = id || null;
    if (!siteId && slug) {
      const row = (await db.select().from(schema.sites).where({ slug } as any).limit(1))[0];
      siteId = row?.id || null;
    }
    if (!siteId) throw new Error('id or slug required');
    const status = await startSite(siteId);
    await db.update(schema.sites).set({ is_published: true } as any).where({ id: siteId } as any);
    return { ok: true, status };
  },
};

export const unpublishSiteTool: ToolDefinition<{ id?: number; slug?: string }> = {
  name: 'unpublish_site',
  description: 'Unpublish and stop a site by id or slug',
  parameters: { type: 'object', properties: { id: { type: 'number' }, slug: { type: 'string' } } },
  async execute({ id, slug }) {
    const db = await getDb();
    let siteId = id || null;
    if (!siteId && slug) {
      const row = (await db.select().from(schema.sites).where({ slug } as any).limit(1))[0];
      siteId = row?.id || null;
    }
    if (!siteId) throw new Error('id or slug required');
    await stopSite(siteId);
    await db.update(schema.sites).set({ is_published: false } as any).where({ id: siteId } as any);
    return { ok: true };
  },
};

