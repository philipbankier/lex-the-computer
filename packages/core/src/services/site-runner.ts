import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../lib/env.js';
import { getDb, schema } from '../lib/db.js';

type ProcInfo = { proc: ChildProcess; port: number };
const processes = new Map<number, ProcInfo>();
let nextPort = 4100;

function siteDir(slug: string) {
  return path.join(env.WORKSPACE_DIR, 'sites', slug);
}

async function readLexsite(dir: string) {
  try {
    const raw = await fs.readFile(path.join(dir, 'lexsite.json'), 'utf8');
    return JSON.parse(raw) as { entrypoint?: string };
  } catch {
    return {} as any;
  }
}

export async function startSite(siteId: number) {
  if (processes.has(siteId)) return getSiteStatus(siteId);
  const db = await getDb();
  const site = (await db.select().from(schema.sites).where({ id: siteId } as any).limit(1))[0];
  if (!site) throw new Error('site not found');
  const dir = siteDir(site.slug);
  const cfg = await readLexsite(dir);
  const entry = cfg.entrypoint || 'bun run index.ts';
  const port = site.port || nextPort++;

  const envVars = { ...process.env, PORT: String(port) };
  const proc = spawn(entry, { cwd: dir, shell: true, env: envVars, stdio: 'ignore' });
  processes.set(siteId, { proc, port });
  await db.update(schema.sites).set({ port, pid: proc.pid || null } as any).where({ id: siteId } as any);
  return { status: 'running', port };
}

export async function stopSite(siteId: number) {
  const info = processes.get(siteId);
  if (!info) return { status: 'stopped' };
  try {
    info.proc.kill('SIGTERM');
  } catch {}
  processes.delete(siteId);
  const db = await getDb();
  await db.update(schema.sites).set({ pid: null } as any).where({ id: siteId } as any);
  return { status: 'stopped' };
}

export async function restartSite(siteId: number) {
  await stopSite(siteId);
  return await startSite(siteId);
}

export function getSiteStatus(siteId: number) {
  const info = processes.get(siteId);
  if (!info) return { status: 'stopped', port: null as any };
  return { status: 'running', port: info.port };
}

