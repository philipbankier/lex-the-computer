import { env } from './env.js';

// Lazy/dynamic imports so builds pass without deps installed.
async function getBull() {
  try {
    const mod = await import('bullmq');
    return mod as any;
  } catch (e) {
    return null;
  }
}

async function getIORedis() {
  try {
    const mod = await import('ioredis');
    return mod as any;
  } catch (e) {
    return null;
  }
}

let _queue: any = null;
let _worker: any = null;

export async function getQueue() {
  if (_queue) return _queue;
  const bull = await getBull();
  const IORedis = await getIORedis();
  if (!bull || !IORedis) return null;
  const connection = new IORedis.default(env.REDIS_URL);
  _queue = new bull.Queue('agents', { connection });
  return _queue;
}

export async function ensureWorker(processor: (agentId: number) => Promise<void>) {
  if (_worker) return _worker;
  const bull = await getBull();
  const IORedis = await getIORedis();
  if (!bull || !IORedis) return null;
  const connection = new IORedis.default(env.REDIS_URL);
  _worker = new bull.Worker(
    'agents',
    async (job: any) => {
      const id = job?.data?.agentId;
      if (typeof id === 'number') {
        await processor(id);
      }
    },
    { connection }
  );
  return _worker;
}

export async function scheduleAgent(id: number, cron: string) {
  const q = await getQueue();
  if (!q) return null;
  const name = `agent:${id}`;
  // Remove existing repeatable job for this agent
  try {
    const jobs = await q.getRepeatableJobs();
    const existing = jobs.find((j: any) => j.name === name);
    if (existing) await q.removeRepeatableByKey(existing.key);
  } catch {}
  // Add new repeatable
  return q.add(name, { agentId: id }, { repeat: { pattern: cron }, jobId: name });
}

export async function removeAgentSchedule(id: number) {
  const q = await getQueue();
  if (!q) return null;
  try {
    const name = `agent:${id}`;
    const jobs = await q.getRepeatableJobs();
    const existing = jobs.find((j: any) => j.name === name);
    if (existing) await q.removeRepeatableByKey(existing.key);
  } catch {}
  return null;
}

export async function runAgentNow(id: number) {
  const q = await getQueue();
  if (!q) return null;
  return q.add('run-now', { agentId: id });
}
