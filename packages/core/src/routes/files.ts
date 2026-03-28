import { Hono } from 'hono';
import path from 'node:path';
import fs from 'node:fs/promises';

export const filesRouter = new Hono();

// Base workspace dir (phase 1: local folder). If not present, return empty.
const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');

function within(base: string, target: string) {
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function listFiles(root: string, max = 500) {
  const out: { path: string; size: number }[] = [];
  async function walk(dir: string) {
    if (out.length >= max) return;
    let entries: any[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        try {
          const stat = await fs.stat(full);
          const rel = path.relative(root, full);
          out.push({ path: rel, size: stat.size });
        } catch {}
      }
      if (out.length >= max) break;
    }
  }
  await walk(root);
  return out;
}

filesRouter.get('/', async (c) => {
  try {
    const files = await listFiles(WORKSPACE_DIR).catch(() => []);
    return c.json({ base: 'workspace', files });
  } catch (e: any) {
    return c.json({ base: 'workspace', files: [], error: e?.message || 'failed' });
  }
});

filesRouter.get('/content', async (c) => {
  const p = c.req.query('path') || '';
  const abs = path.resolve(WORKSPACE_DIR, p);
  if (!within(WORKSPACE_DIR, abs)) return c.json({ error: 'invalid path' }, 400);
  let data = '';
  try {
    data = await fs.readFile(abs, 'utf8');
  } catch {
    return c.json({ error: 'read failed' }, 404);
  }
  // Return a trimmed snippet to keep prompt size sane
  const snippet = data.slice(0, 8000);
  return c.json({ path: p, length: data.length, snippet });
});

