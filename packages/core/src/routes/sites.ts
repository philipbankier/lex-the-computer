import { Hono } from 'hono';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../lib/env.js';
import { getDb, schema } from '../lib/db.js';
import { startSite, stopSite, restartSite, getSiteStatus } from '../services/site-runner.js';

export const sitesRouter = new Hono();
const userIdFromCtx = () => 1;

const sitesBase = path.join(env.WORKSPACE_DIR, 'sites');

function within(base: string, target: string) {
  const rel = path.relative(base, target);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function siteDir(slug: string) { return path.join(sitesBase, slug); }

// CRUD
sitesRouter.post('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json().catch(() => ({} as any));
  const name = String(body.name || '').trim();
  const slug = String(body.slug || '').trim();
  if (!name || !slug) return c.json({ error: 'name and slug required' }, 400);
  const [row] = await db.insert(schema.sites).values({ user_id, name, slug, framework: 'hono', is_published: false } as any).returning();
  // scaffold files
  const dir = siteDir(slug);
  await fs.mkdir(dir, { recursive: true });
  const indexTs = `import { Hono } from 'hono';\nconst app = new Hono();\napp.get('/', (c) => c.text('Hello from ' + ${JSON.stringify(name)}));\nexport default { port: Number(process.env.PORT)||4100, fetch: app.fetch };\n`;
  const pkgJson = { name: slug, private: true, type: 'module', scripts: { dev: 'bun run index.ts', start: 'bun run index.ts' }, dependencies: { hono: '^4.5.7' } };
  const lexCfg = { name, slug, framework: 'hono', entrypoint: 'bun run index.ts' };
  await fs.writeFile(path.join(dir, 'index.ts'), indexTs, 'utf8');
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');
  await fs.writeFile(path.join(dir, 'lexsite.json'), JSON.stringify(lexCfg, null, 2), 'utf8');
  return c.json(row);
});

sitesRouter.get('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.sites).where({ user_id } as any);
  const withStatus = await Promise.all(rows.map(async (r) => ({ ...r, status: getSiteStatus(r.id) })));
  return c.json(withStatus);
});

sitesRouter.get('/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.sites).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json({ ...row, status: getSiteStatus(id) });
});

sitesRouter.patch('/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({} as any));
  const updates: any = {};
  for (const k of ['name', 'slug', 'is_published', 'custom_domain']) if (k in body) updates[k] = body[k];
  const [row] = await db.update(schema.sites).set(updates).where({ id } as any).returning();
  return c.json(row);
});

sitesRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  await stopSite(id);
  const row = (await db.select().from(schema.sites).where({ id } as any).limit(1))[0];
  if (row) {
    const dir = siteDir(row.slug);
    try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
  }
  await db.delete(schema.sites).where({ id } as any);
  return c.json({ ok: true });
});

sitesRouter.post('/:id/publish', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const status = await startSite(id);
  await db.update(schema.sites).set({ is_published: true } as any).where({ id } as any);
  return c.json({ ok: true, status });
});

sitesRouter.post('/:id/unpublish', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  await stopSite(id);
  await db.update(schema.sites).set({ is_published: false } as any).where({ id } as any);
  return c.json({ ok: true });
});

sitesRouter.post('/:id/restart', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10);
  const status = await restartSite(id);
  return c.json({ ok: true, status });
});

// Files within site directory
sitesRouter.get('/:id/files', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.sites).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  const dir = siteDir(row.slug);
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as any[]);
  const list = await Promise.all(entries.map(async (e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other' })));
  return c.json({ entries: list });
});

sitesRouter.get('/:id/files/content', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const file = c.req.query('path') || '';
  const row = (await db.select().from(schema.sites).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  const base = siteDir(row.slug);
  const abs = path.resolve(base, file);
  if (!within(base, abs)) return c.json({ error: 'invalid path' }, 400);
  const data = await fs.readFile(abs, 'utf8').catch(() => null as any);
  if (data == null) return c.json({ error: 'read failed' }, 404);
  return c.json({ path: file, content: data });
});

sitesRouter.post('/:id/files/content', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({} as any));
  const file = String(body.path || '');
  const content = String(body.content ?? '');
  const row = (await db.select().from(schema.sites).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  const base = siteDir(row.slug);
  const abs = path.resolve(base, file);
  if (!within(base, abs)) return c.json({ error: 'invalid path' }, 400);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return c.json({ ok: true });
});

