import { Hono } from 'hono';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../lib/env.js';
import { getDb, schema } from '../lib/db.js';
import { parseSkillMd } from '../services/skill-loader.js';

export const skillsRouter = new Hono();
const userIdFromCtx = () => 1; // Phase 0 placeholder auth

const skillsBase = () => path.join(env.WORKSPACE_DIR, 'skills');

// --- Installed Skills CRUD ---

// List installed skills
skillsRouter.get('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const rows = await db.select().from(schema.skills).where({ user_id } as any);
  return c.json(rows);
});

// Get single skill details (includes SKILL.md content)
skillsRouter.get('/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.skills).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);

  let skillMdContent = '';
  if (row.directory) {
    try {
      skillMdContent = await fs.readFile(path.join(row.directory, 'SKILL.md'), 'utf8');
    } catch { /* no SKILL.md */ }
  }
  return c.json({ ...row, skillMdContent });
});

// Create a new skill (scaffolds directory + SKILL.md)
skillsRouter.post('/', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const body = await c.req.json().catch(() => ({} as any));
  const name = String(body.name || '').trim();
  if (!name) return c.json({ error: 'name required' }, 400);
  const description = String(body.description || '').trim();

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dir = path.join(skillsBase(), slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(dir, 'references'), { recursive: true });
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });

  const skillMd = `---
name: ${slug}
description: ${description || 'A custom skill'}
compatibility:
  - lex
metadata:
  author: user
  version: 1.0.0
  tags: []
  icon: "\u2699\uFE0F"
allowed-tools: []
---

# ${name}

Add your skill instructions here. The AI will follow these instructions when this skill is activated.
`;
  await fs.writeFile(path.join(dir, 'SKILL.md'), skillMd, 'utf8');

  const [row] = await db
    .insert(schema.skills)
    .values({
      user_id,
      name,
      description,
      author: 'user',
      version: '1.0.0',
      icon: '\u2699\uFE0F',
      directory: dir,
      source: 'local',
      is_active: true,
    } as any)
    .returning();

  return c.json(row);
});

// Toggle active/inactive
skillsRouter.put('/:id/toggle', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.skills).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  const [updated] = await db.update(schema.skills).set({ is_active: !row.is_active, updated_at: new Date() } as any).where({ id } as any).returning();
  return c.json(updated);
});

// Delete / uninstall skill
skillsRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.skills).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.directory) {
    try { await fs.rm(row.directory, { recursive: true, force: true }); } catch { /* ok */ }
  }
  await db.delete(schema.skills).where({ id } as any);
  return c.json({ ok: true });
});

// List files in skill directory
skillsRouter.get('/:id/files', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.skills).where({ id } as any).limit(1))[0];
  if (!row || !row.directory) return c.json({ error: 'not found' }, 404);
  try {
    const entries = await fs.readdir(row.directory, { withFileTypes: true, recursive: true });
    const files = entries.map((e) => ({
      name: e.name,
      path: path.relative(row.directory!, path.join(e.parentPath || e.path, e.name)),
      isDirectory: e.isDirectory(),
    }));
    return c.json(files);
  } catch {
    return c.json([]);
  }
});

// --- Hub API ---

// List hub skills (with search + tag filter)
skillsRouter.get('/hub/list', async (c) => {
  const db = await getDb();
  const q = (c.req.query('q') || '').toLowerCase();
  const tagsParam = c.req.query('tags') || '';

  let rows = await db.select().from(schema.skills_hub);

  if (q) {
    rows = rows.filter((r) => {
      const haystack = `${r.name} ${r.description || ''} ${r.author || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }
  if (tagsParam) {
    const filterTags = tagsParam.split(',').map((t) => t.trim().toLowerCase());
    rows = rows.filter((r) => {
      const tags: string[] = r.tags ? JSON.parse(r.tags) : [];
      return filterTags.some((ft) => tags.map((t) => t.toLowerCase()).includes(ft));
    });
  }

  // Also mark which ones are installed
  const user_id = userIdFromCtx();
  const installed = await db.select().from(schema.skills).where({ user_id } as any);
  const installedHubIds = new Set(installed.filter((s) => s.hub_id).map((s) => s.hub_id));

  const result = rows.map((r) => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : [],
    isInstalled: installedHubIds.has(r.id),
  }));

  return c.json(result);
});

// Get hub skill detail
skillsRouter.get('/hub/:id', async (c) => {
  const db = await getDb();
  const id = Number.parseInt(c.req.param('id'), 10);
  const row = (await db.select().from(schema.skills_hub).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json({ ...row, tags: row.tags ? JSON.parse(row.tags) : [] });
});

// Install from hub
skillsRouter.post('/hub/:id/install', async (c) => {
  const db = await getDb();
  const user_id = userIdFromCtx();
  const hubId = Number.parseInt(c.req.param('id'), 10);
  const hubSkill = (await db.select().from(schema.skills_hub).where({ id: hubId } as any).limit(1))[0];
  if (!hubSkill) return c.json({ error: 'hub skill not found' }, 404);

  // Check if already installed
  const existing = (await db.select().from(schema.skills).where({ user_id, hub_id: hubId } as any).limit(1))[0];
  if (existing) return c.json({ error: 'already installed', skill: existing }, 409);

  const slug = hubSkill.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dir = path.join(skillsBase(), slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(dir, 'references'), { recursive: true });
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });

  // Write SKILL.md from hub content
  if (hubSkill.skill_md) {
    await fs.writeFile(path.join(dir, 'SKILL.md'), hubSkill.skill_md, 'utf8');
  }

  // Write README if available
  if (hubSkill.readme) {
    await fs.writeFile(path.join(dir, 'README.md'), hubSkill.readme, 'utf8');
  }

  const [row] = await db
    .insert(schema.skills)
    .values({
      user_id,
      name: hubSkill.name,
      description: hubSkill.description,
      author: hubSkill.author,
      version: hubSkill.version,
      icon: hubSkill.icon,
      directory: dir,
      source: 'hub',
      hub_id: hubId,
      is_active: true,
    } as any)
    .returning();

  // Increment downloads
  await db.update(schema.skills_hub).set({ downloads: (hubSkill.downloads || 0) + 1 } as any).where({ id: hubId } as any);

  return c.json(row);
});

// Search hub (alias for /hub/list with q param)
skillsRouter.get('/hub/search', async (c) => {
  // Redirect to list with same params
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/hub/search', '/hub/list');
  const db = await getDb();
  const q = (c.req.query('q') || '').toLowerCase();
  const rows = await db.select().from(schema.skills_hub);
  const filtered = q ? rows.filter((r) => `${r.name} ${r.description || ''} ${r.tags || ''}`.toLowerCase().includes(q)) : rows;
  return c.json(filtered.map((r) => ({ ...r, tags: r.tags ? JSON.parse(r.tags) : [] })));
});
