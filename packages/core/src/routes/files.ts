import { Hono } from 'hono';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { exec } from 'node:child_process';
import { env } from '../lib/env.js';

export const filesRouter = new Hono();

const WORKSPACE_DIR = env.WORKSPACE_DIR;

function within(base: string, target: string) {
  const rel = path.relative(base, target);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function safeResolve(p: string) {
  const abs = path.resolve(WORKSPACE_DIR, p || '.');
  if (!within(WORKSPACE_DIR, abs)) throw new Error('invalid path');
  return abs;
}

filesRouter.get('/', async (c) => {
  const rel = c.req.query('path') || '';
  const dir = safeResolve(rel);
  let entries: any[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e: any) {
    return c.json({ error: e?.message || 'failed' }, 400);
  }
  const rows = await Promise.all(
    entries.map(async (e) => {
      const full = path.join(dir, e.name);
      const st = await fs.stat(full).catch(() => null as any);
      const type = e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other';
      return {
        name: e.name,
        path: path.relative(WORKSPACE_DIR, full),
        type,
        size: st?.size ?? 0,
        modified: st?.mtime?.toISOString?.() || null,
      };
    })
  );
  return c.json({ entries: rows });
});

filesRouter.get('/content', async (c) => {
  const p = c.req.query('path') || '';
  const abs = safeResolve(p);
  let data = '';
  try {
    data = await fs.readFile(abs, 'utf8');
  } catch {
    return c.json({ error: 'read failed' }, 404);
  }
  const snippet = data.slice(0, 8000);
  return c.json({ path: p, length: data.length, snippet });
});

filesRouter.post('/content', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const p = body.path as string;
  const content = (body.content as string) ?? '';
  if (!p) return c.json({ error: 'path required' }, 400);
  const abs = safeResolve(p);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  return c.json({ ok: true });
});

filesRouter.patch('/content', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const p = body.path as string;
  const np = body.newPath as string;
  if (!p || !np) return c.json({ error: 'path and newPath required' }, 400);
  const abs = safeResolve(p);
  const dest = safeResolve(np);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(abs, dest);
  return c.json({ ok: true });
});

filesRouter.delete('/', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const p = body.path as string;
  if (!p) return c.json({ error: 'path required' }, 400);
  const abs = safeResolve(p);
  await fs.rm(abs, { recursive: true, force: true });
  return c.json({ ok: true });
});

filesRouter.post('/mkdir', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const p = body.path as string;
  if (!p) return c.json({ error: 'path required' }, 400);
  const abs = safeResolve(p);
  await fs.mkdir(abs, { recursive: true });
  return c.json({ ok: true });
});

filesRouter.post('/upload', async (c) => {
  const form = await c.req.parseBody();
  const dirRel = (form.dir as string) || '';
  const dir = safeResolve(dirRel);
  await fs.mkdir(dir, { recursive: true });

  const saveOne = async (f: File) => {
    const name = (f as any).name || 'upload.bin';
    const buf = Buffer.from(await f.arrayBuffer());
    const dest = path.join(dir, name);
    if (!within(WORKSPACE_DIR, dest)) throw new Error('invalid file path');
    await fs.writeFile(dest, buf);
    return { name, path: path.relative(WORKSPACE_DIR, dest), size: buf.length };
  };

  const filesField = form.file || form.files;
  const results: any[] = [];
  if (Array.isArray(filesField)) {
    for (const item of filesField) {
      if (item instanceof File) results.push(await saveOne(item));
    }
  } else if (filesField instanceof File) {
    results.push(await saveOne(filesField));
  } else {
    // scan all fields for File
    for (const k of Object.keys(form)) {
      const v: any = (form as any)[k];
      if (v instanceof File) results.push(await saveOne(v));
      else if (Array.isArray(v)) {
        for (const vv of v) if (vv instanceof File) results.push(await saveOne(vv));
      }
    }
  }
  return c.json({ uploaded: results });
});

filesRouter.get('/download', async (c) => {
  const p = c.req.query('path') || '';
  const abs = safeResolve(p);
  const st = await fs.stat(abs).catch(() => null as any);
  if (!st || !st.isFile()) return c.json({ error: 'not a file' }, 400);
  const filename = path.basename(abs);
  const stream = createReadStream(abs);
  return new Response(stream as any, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

filesRouter.get('/download-zip', async (c) => {
  const rel = c.req.query('path') || '';
  const dir = safeResolve(rel);
  const st = await fs.stat(dir).catch(() => null as any);
  if (!st || !st.isDirectory()) return c.json({ error: 'not a directory' }, 400);
  const base = path.basename(dir) || 'archive';
  // Use tar.gz stream to avoid extra deps
  const cmd = `tar -czf - -C ${JSON.stringify(path.dirname(dir))} ${JSON.stringify(path.basename(dir))}`;
  return await new Promise<Response>((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 200 }, (err, stdout) => {
      if (err) {
        resolve(new Response(JSON.stringify({ error: 'archive failed' }), { status: 500 }));
        return;
      }
      resolve(
        new Response(Buffer.from(stdout, 'binary'), {
          headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${base}.tar.gz"`,
          },
        })
      );
    });
  });
});

filesRouter.get('/search', async (c) => {
  const q = c.req.query('q') || '';
  const type = c.req.query('type') || 'content';
  if (!q) return c.json({ results: [] });
  if (type === 'filename') {
    const results: any[] = [];
    const walk = async (dir: string) => {
      const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as any[]);
      for (const e of ents) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (e.isFile() && e.name.toLowerCase().includes(q.toLowerCase())) {
          results.push({ path: path.relative(WORKSPACE_DIR, full) });
        }
      }
    };
    await walk(WORKSPACE_DIR);
    return c.json({ results });
  } else {
    const cmd = `grep -RIn --exclude-dir=.git ${JSON.stringify(q)} ${JSON.stringify(WORKSPACE_DIR)}`;
    const results = await new Promise<any[]>((resolve) => {
      exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout) => {
        if (err && (err as any).code !== 1) return resolve([]);
        const lines = stdout.split('\n').filter(Boolean);
        const rows = lines.map((line) => {
          const [file, lineNo, ...rest] = line.split(':');
          return { path: path.relative(WORKSPACE_DIR, file), line: Number(lineNo), text: rest.join(':') };
        });
        resolve(rows);
      });
    });
    return c.json({ results });
  }
});
