import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { getDb, schema } from '../lib/db.js';

type LogLine = { t: number; s: 'out' | 'err'; d: string };
type ProcInfo = { proc: ChildProcess; logs: LogLine[] };
const processes = new Map<number, ProcInfo>();

function pushLog(info: ProcInfo, s: 'out' | 'err', chunk: any) {
  const str = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk ?? '');
  for (const line of str.split(/\r?\n/)) {
    if (!line) continue;
    info.logs.push({ t: Date.now(), s, d: line });
    if (info.logs.length > 1000) info.logs.splice(0, info.logs.length - 1000);
  }
}

export async function startService(id: number) {
  if (processes.has(id)) return { status: 'running' };
  const db = await getDb();
  const svc = (await db.select().from(schema.services).where({ id } as any).limit(1))[0];
  if (!svc) throw new Error('service not found');
  const cwd = svc.working_dir || process.cwd();
  const envVars = { ...process.env, PORT: svc.port ? String(svc.port) : undefined } as any;
  const info: ProcInfo = { proc: spawn(svc.entrypoint || '', { cwd: path.resolve(cwd), shell: true, env: envVars }), logs: [] };
  info.proc.stdout?.on('data', (c) => pushLog(info, 'out', c));
  info.proc.stderr?.on('data', (c) => pushLog(info, 'err', c));
  info.proc.on('close', () => processes.delete(id));
  processes.set(id, info);
  await db.update(schema.services).set({ is_running: true } as any).where({ id } as any);
  return { status: 'running' };
}

export async function stopService(id: number) {
  const info = processes.get(id);
  if (!info) return { status: 'stopped' };
  try { info.proc.kill('SIGTERM'); } catch {}
  processes.delete(id);
  const db = await getDb();
  await db.update(schema.services).set({ is_running: false } as any).where({ id } as any);
  return { status: 'stopped' };
}

export async function restartService(id: number) {
  await stopService(id);
  return await startService(id);
}

export function getServiceLogs(id: number, limit = 1000) {
  const info = processes.get(id);
  const lines = info ? info.logs.slice(-limit) : [];
  return lines.map((l) => `${new Date(l.t).toISOString()} [${l.s}] ${l.d}`);
}

