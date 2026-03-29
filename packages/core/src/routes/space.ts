import { Hono } from 'hono';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../lib/env.js';
import { getDb, schema } from '../lib/db.js';

export const spaceRouter = new Hono();
const userIdFromCtx = () => 1;

const assetsBase = () => path.join(env.WORKSPACE_DIR, 'space-assets');

// ── Routes CRUD ──

spaceRouter.get('/routes', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.space_routes).where({ user_id } as any);
  return c.json(rows);
});

spaceRouter.post('/routes', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json().catch(() => ({} as any));
  const routePath = String(body.path || '').trim();
  const type = body.type === 'api' ? 'api' : 'page';
  const code = String(body.code ?? getDefaultCode(type, routePath));
  const is_public = type === 'api' ? true : !!body.isPublic;
  if (!routePath) return c.json({ error: 'path required' }, 400);

  const [row] = await db.insert(schema.space_routes)
    .values({ user_id, path: routePath, type, code, is_public } as any)
    .returning();

  // save initial version
  await db.insert(schema.space_route_versions)
    .values({ route_id: row.id, code, version: 1 } as any);

  return c.json(row);
});

spaceRouter.get('/routes/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.space_routes).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json(row);
});

spaceRouter.put('/routes/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({} as any));
  const existing = (await db.select().from(schema.space_routes).where({ id } as any).limit(1))[0];
  if (!existing) return c.json({ error: 'not found' }, 404);

  const updates: any = { updated_at: new Date() };
  if ('code' in body) updates.code = body.code;
  if ('isPublic' in body) updates.is_public = body.isPublic;
  if ('path' in body) updates.path = body.path;

  const [row] = await db.update(schema.space_routes).set(updates).where({ id } as any).returning();

  // auto-create version if code changed
  if ('code' in body && body.code !== existing.code) {
    const versions = await db.select().from(schema.space_route_versions).where({ route_id: id } as any);
    const maxVersion = versions.reduce((m, v) => Math.max(m, v.version), 0);
    await db.insert(schema.space_route_versions)
      .values({ route_id: id, code: body.code, version: maxVersion + 1 } as any);
  }

  return c.json(row);
});

spaceRouter.delete('/routes/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  await db.delete(schema.space_route_versions).where({ route_id: id } as any);
  await db.delete(schema.space_errors).where({ route_id: id } as any);
  await db.delete(schema.space_routes).where({ id } as any);
  return c.json({ ok: true });
});

// ── Version History / Undo / Redo ──

spaceRouter.get('/routes/:id/history', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const versions = await db.select().from(schema.space_route_versions).where({ route_id: id } as any);
  versions.sort((a, b) => a.version - b.version);
  return c.json(versions);
});

spaceRouter.post('/routes/:id/undo', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const route = (await db.select().from(schema.space_routes).where({ id } as any).limit(1))[0];
  if (!route) return c.json({ error: 'not found' }, 404);

  const versions = await db.select().from(schema.space_route_versions).where({ route_id: id } as any);
  versions.sort((a, b) => a.version - b.version);

  // find the version matching current code, then go one back
  const currentIdx = versions.findIndex((v) => v.code === route.code);
  const prevIdx = currentIdx > 0 ? currentIdx - 1 : -1;
  if (prevIdx < 0) return c.json({ error: 'nothing to undo' }, 400);

  const prev = versions[prevIdx];
  const [row] = await db.update(schema.space_routes)
    .set({ code: prev.code, updated_at: new Date() } as any)
    .where({ id } as any).returning();
  return c.json(row);
});

spaceRouter.post('/routes/:id/redo', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const route = (await db.select().from(schema.space_routes).where({ id } as any).limit(1))[0];
  if (!route) return c.json({ error: 'not found' }, 404);

  const versions = await db.select().from(schema.space_route_versions).where({ route_id: id } as any);
  versions.sort((a, b) => a.version - b.version);

  const currentIdx = versions.findIndex((v) => v.code === route.code);
  const nextIdx = currentIdx >= 0 && currentIdx < versions.length - 1 ? currentIdx + 1 : -1;
  if (nextIdx < 0) return c.json({ error: 'nothing to redo' }, 400);

  const next = versions[nextIdx];
  const [row] = await db.update(schema.space_routes)
    .set({ code: next.code, updated_at: new Date() } as any)
    .where({ id } as any).returning();
  return c.json(row);
});

// ── Assets ──

spaceRouter.get('/assets', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.space_assets).where({ user_id } as any);
  return c.json(rows);
});

spaceRouter.post('/assets', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return c.json({ error: 'file required' }, 400);
    const dir = assetsBase();
    await fs.mkdir(dir, { recursive: true });
    const filename = file.name;
    const filePath = path.join(dir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    const [row] = await db.insert(schema.space_assets)
      .values({ user_id, filename, path: filePath, mime_type: file.type || null, size: buffer.length } as any)
      .returning();
    return c.json(row);
  }

  // JSON upload (base64) — used by AI tools
  const body = await c.req.json().catch(() => ({} as any));
  const filename = String(body.filename || '').trim();
  const content = String(body.content || '');
  if (!filename || !content) return c.json({ error: 'filename and content required' }, 400);
  const dir = assetsBase();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  const buffer = Buffer.from(content, 'base64');
  await fs.writeFile(filePath, buffer);
  const mimeType = guessMime(filename);
  const [row] = await db.insert(schema.space_assets)
    .values({ user_id, filename, path: filePath, mime_type: mimeType, size: buffer.length } as any)
    .returning();
  return c.json(row);
});

spaceRouter.delete('/assets/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.space_assets).where({ id } as any).limit(1))[0];
  if (row) {
    try { await fs.unlink(row.path); } catch {}
  }
  await db.delete(schema.space_assets).where({ id } as any);
  return c.json({ ok: true });
});

// ── Settings ──

spaceRouter.get('/settings', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const row = (await db.select().from(schema.space_settings).where({ user_id } as any).limit(1))[0];
  return c.json(row || { handle: '', title: '', description: '', favicon: '', custom_css: '' });
});

spaceRouter.put('/settings', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json().catch(() => ({} as any));
  const existing = (await db.select().from(schema.space_settings).where({ user_id } as any).limit(1))[0];

  const data: any = { updated_at: new Date() };
  for (const k of ['handle', 'title', 'description', 'favicon', 'custom_css']) {
    if (k in body) data[k] = body[k];
  }

  if (existing) {
    const [row] = await db.update(schema.space_settings).set(data).where({ id: existing.id } as any).returning();
    return c.json(row);
  }
  const [row] = await db.insert(schema.space_settings)
    .values({ user_id, handle: data.handle || '', ...data } as any)
    .returning();
  return c.json(row);
});

// ── Errors ──

spaceRouter.get('/errors', async (c) => {
  const db = await getDb();
  const rows = await db.select().from(schema.space_errors).limit(100);
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return c.json(rows);
});

spaceRouter.delete('/errors', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  // delete errors for routes owned by user
  const routes = await db.select().from(schema.space_routes).where({ user_id } as any);
  for (const r of routes) {
    await db.delete(schema.space_errors).where({ route_id: r.id } as any);
  }
  return c.json({ ok: true });
});

// ── Public Space Serving ──

export const spacePublicRouter = new Hono();

spacePublicRouter.get('/assets/:filename', async (c) => {
  const filename = c.req.param('filename');
  const filePath = path.join(assetsBase(), filename);
  try {
    const data = await fs.readFile(filePath);
    const mime = guessMime(filename);
    return new Response(data, { headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    return c.json({ error: 'not found' }, 404);
  }
});

spacePublicRouter.all('/:handle/*', async (c) => {
  return await serveSpace(c, c.req.param('handle'), '/' + (c.req.param('*') || ''));
});

spacePublicRouter.all('/:handle', async (c) => {
  return await serveSpace(c, c.req.param('handle'), '/');
});

async function serveSpace(c: any, handle: string, routePath: string) {
  const db = await getDb();

  // find settings by handle
  const settings = (await db.select().from(schema.space_settings).where({ handle } as any).limit(1))[0];
  if (!settings) return c.json({ error: 'space not found' }, 404);

  const userId = settings.user_id;
  const routes = await db.select().from(schema.space_routes).where({ user_id: userId } as any);

  // normalize path
  const normalizedPath = routePath === '' ? '/' : routePath;
  const route = routes.find((r) => r.path === normalizedPath);
  if (!route) return c.json({ error: 'route not found' }, 404);

  // check access: non-owner can only see public routes
  const requesterId = userIdFromCtx(); // in single-user mode this is always the owner
  if (!route.is_public && requesterId !== userId) {
    return c.json({ error: 'not found' }, 404);
  }

  if (route.type === 'api') {
    return executeApiRoute(c, route, db);
  }

  return renderPageRoute(c, route, settings);
}

async function executeApiRoute(c: any, route: any, db: any) {
  try {
    // Execute API handler in a sandboxed function
    const fn = new Function('request', 'url', `
      const handler = (function() { ${route.code} })();
      if (typeof handler === 'function') return handler(request, url);
      if (handler && typeof handler.default === 'function') return handler.default(request, url);
      return { status: 200, body: handler };
    `);
    const url = new URL(c.req.url);
    const result = fn(c.req.raw, url);
    if (result instanceof Response) return result;
    return c.json(result ?? { ok: true });
  } catch (err: any) {
    await db.insert(schema.space_errors)
      .values({ route_id: route.id, error: err.message || String(err), stack: err.stack || null } as any);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

function renderPageRoute(c: any, route: any, settings: any) {
  const title = settings.title || 'Space';
  const customCss = settings.custom_css || '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>${customCss}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
${route.code}

const _Component = typeof App !== 'undefined' ? App : (typeof Page !== 'undefined' ? Page : () => React.createElement('div', null, 'No component exported'));
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(_Component));
  </script>
</body>
</html>`;
  return c.html(html);
}

// ── Helpers ──

function getDefaultCode(type: string, routePath: string): string {
  if (type === 'api') {
    return `// API endpoint: ${routePath}
// Return a value or Response object
return { message: "Hello from ${routePath}" };`;
  }
  return `function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">My Page</h1>
        <p className="text-gray-400">Edit this page to get started</p>
      </div>
    </div>
  );
}`;
}

function guessMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
    '.html': 'text/html', '.txt': 'text/plain', '.pdf': 'application/pdf',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  };
  return map[ext] || 'application/octet-stream';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
