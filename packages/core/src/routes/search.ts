import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq, ilike, and, desc } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env.js';

export const searchRouter = new Hono();
const userIdFromCtx = () => 1;

searchRouter.get('/', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const q = c.req.query('q') || '';
  if (!q.trim()) return c.json({ conversations: [], files: [], automations: [], skills: [] });

  const pattern = `%${q}%`;

  // Search conversations by title
  const conversations = await db.select().from(schema.conversations)
    .where(and(eq(schema.conversations.user_id, id), ilike(schema.conversations.title, pattern)))
    .orderBy(desc(schema.conversations.updated_at))
    .limit(5);

  // Search automations by name
  const automations = await db.select().from(schema.automations)
    .where(and(eq(schema.automations.user_id, id), ilike(schema.automations.name, pattern)))
    .limit(5);

  // Search skills by name
  const skills = await db.select().from(schema.skills)
    .where(and(eq(schema.skills.user_id, id), ilike(schema.skills.name, pattern)))
    .limit(5);

  // Search files by name (workspace scan)
  const files: { name: string; path: string }[] = [];
  try {
    const workDir = path.join(env.WORKSPACE_DIR, 'files');
    await searchDir(workDir, q.toLowerCase(), files, env.WORKSPACE_DIR);
  } catch { /* ignore */ }

  return c.json({ conversations, files: files.slice(0, 10), automations, skills });
});

async function searchDir(dir: string, query: string, results: { name: string; path: string }[], baseDir: string) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= 10) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.name.toLowerCase().includes(query)) {
        results.push({ name: entry.name, path: fullPath.replace(baseDir, '') });
      }
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await searchDir(fullPath, query, results, baseDir);
      }
    }
  } catch { /* ignore */ }
}
