import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolDefinition } from './types.js';
import { env } from '../lib/env.js';
import { getDb, schema } from '../lib/db.js';

export const createSiteTool: ToolDefinition<{ name: string; slug: string }> = {
  name: 'create_site',
  description: 'Create a new site with a basic Hono+Bun scaffold in workspace/sites/{slug}',
  parameters: { type: 'object', properties: { name: { type: 'string' }, slug: { type: 'string' } }, required: ['name', 'slug'] },
  async execute({ name, slug }) {
    const db = await getDb();
    const user_id = 1;
    const [row] = await db.insert(schema.sites).values({ user_id, name, slug, framework: 'hono', is_published: false } as any).returning();
    const dir = path.join(env.WORKSPACE_DIR, 'sites', slug);
    await fs.mkdir(dir, { recursive: true });
    const indexTs = `import { Hono } from 'hono';\nconst app = new Hono();\napp.get('/', (c) => c.text('Hello from ' + ${JSON.stringify(name)}));\nexport default { port: Number(process.env.PORT)||4100, fetch: app.fetch };\n`;
    const pkgJson = { name: slug, private: true, type: 'module', scripts: { dev: 'bun run index.ts', start: 'bun run index.ts' }, dependencies: { hono: '^4.5.7' } };
    const lexCfg = { name, slug, framework: 'hono', entrypoint: 'bun run index.ts' };
    await fs.writeFile(path.join(dir, 'index.ts'), indexTs, 'utf8');
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');
    await fs.writeFile(path.join(dir, 'lexsite.json'), JSON.stringify(lexCfg, null, 2), 'utf8');
    return { ok: true, site: row };
  },
};

