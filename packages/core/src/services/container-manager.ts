import { env } from '../lib/env.js';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';

let Docker: any = null;
let docker: any = null;

async function getDocker() {
  if (!docker) {
    if (!Docker) {
      const mod = await import('dockerode');
      Docker = mod.default;
    }
    docker = new Docker();
  }
  return docker;
}

const USER_IMAGE = 'lexthecomputer/lex-user:latest';

export function isMultiUser(): boolean {
  return env.MULTI_USER;
}

export async function createContainer(userId: number): Promise<{ containerId: string; hostname: string }> {
  const d = await getDocker();
  const db = await getDb();

  const hostname = `lex-user-${userId}`;
  const workspacePath = `/data/users/${userId}/workspace`;

  const container = await d.createContainer({
    Image: USER_IMAGE,
    name: hostname,
    Hostname: hostname,
    Tty: true,
    HostConfig: {
      CpuQuota: Math.round(parseFloat(env.CONTAINER_CPU_LIMIT) * 100000),
      Memory: parseMemoryLimit(env.CONTAINER_MEMORY_LIMIT),
      Binds: [`${workspacePath}:/workspace`],
      NetworkMode: 'bridge',
      RestartPolicy: { Name: 'unless-stopped' },
    },
    WorkingDir: '/workspace',
  });

  await db.insert(schema.user_containers).values({
    user_id: userId,
    container_id: container.id,
    status: 'creating',
    hostname,
    cpu_limit: env.CONTAINER_CPU_LIMIT,
    memory_limit: env.CONTAINER_MEMORY_LIMIT,
    storage_limit: env.CONTAINER_STORAGE_LIMIT,
  });

  return { containerId: container.id, hostname };
}

export async function startContainer(userId: number): Promise<void> {
  const db = await getDb();
  const d = await getDocker();

  const rows = await db.select().from(schema.user_containers).where(eq(schema.user_containers.user_id, userId));
  const rec = rows[0];
  if (!rec || !rec.container_id) throw new Error('No container for user');

  const container = d.getContainer(rec.container_id);
  await container.start();

  await db.update(schema.user_containers)
    .set({ status: 'running', last_active_at: new Date() })
    .where(eq(schema.user_containers.id, rec.id));
}

export async function stopContainer(userId: number): Promise<void> {
  const db = await getDb();
  const d = await getDocker();

  const rows = await db.select().from(schema.user_containers).where(eq(schema.user_containers.user_id, userId));
  const rec = rows[0];
  if (!rec || !rec.container_id) return;

  try {
    const container = d.getContainer(rec.container_id);
    await container.stop({ t: 10 });
  } catch {
    // container may already be stopped
  }

  await db.update(schema.user_containers)
    .set({ status: 'stopped' })
    .where(eq(schema.user_containers.id, rec.id));
}

export async function execInContainer(userId: number, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const db = await getDb();
  const d = await getDocker();

  const rows = await db.select().from(schema.user_containers).where(eq(schema.user_containers.user_id, userId));
  const rec = rows[0];
  if (!rec || !rec.container_id) throw new Error('No container for user');

  // Ensure container is running
  const container = d.getContainer(rec.container_id);
  const info = await container.inspect();
  if (!info.State.Running) {
    await container.start();
    await db.update(schema.user_containers)
      .set({ status: 'running', last_active_at: new Date() })
      .where(eq(schema.user_containers.id, rec.id));
  }

  const exec = await container.exec({
    Cmd: ['sh', '-c', command],
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: '/workspace',
  });

  const stream = await exec.start({ Detach: false });

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', async () => {
      const output = Buffer.concat(chunks).toString('utf-8');
      const inspection = await exec.inspect();
      // Update last active
      await db.update(schema.user_containers)
        .set({ last_active_at: new Date() })
        .where(eq(schema.user_containers.id, rec.id));
      resolve({ stdout: output, stderr: '', exitCode: inspection.ExitCode ?? 0 });
    });
  });
}

export async function getContainerStatus(userId: number): Promise<{ status: string; containerId?: string } | null> {
  const db = await getDb();
  const rows = await db.select().from(schema.user_containers).where(eq(schema.user_containers.user_id, userId));
  const rec = rows[0];
  if (!rec) return null;
  return { status: rec.status, containerId: rec.container_id ?? undefined };
}

export async function removeContainer(userId: number): Promise<void> {
  const db = await getDb();
  const d = await getDocker();

  const rows = await db.select().from(schema.user_containers).where(eq(schema.user_containers.user_id, userId));
  const rec = rows[0];
  if (!rec || !rec.container_id) return;

  try {
    const container = d.getContainer(rec.container_id);
    await container.stop({ t: 5 }).catch(() => {});
    await container.remove({ force: true });
  } catch {
    // container may not exist
  }

  await db.delete(schema.user_containers).where(eq(schema.user_containers.id, rec.id));
}

export async function listContainers(): Promise<any[]> {
  const db = await getDb();
  return db.select().from(schema.user_containers);
}

/** Stop idle containers that have been inactive past the timeout */
export async function stopIdleContainers(): Promise<number> {
  const db = await getDb();
  const timeoutMs = env.CONTAINER_IDLE_TIMEOUT * 1000;
  const cutoff = new Date(Date.now() - timeoutMs);

  const rows = await db.select().from(schema.user_containers);
  let stopped = 0;

  for (const rec of rows) {
    if (rec.status === 'running' && rec.last_active_at && rec.last_active_at < cutoff) {
      try {
        await stopContainer(rec.user_id);
        stopped++;
      } catch {
        // ignore
      }
    }
  }

  return stopped;
}

function parseMemoryLimit(limit: string): number {
  const match = limit.match(/^(\d+)(g|m|k)?$/i);
  if (!match) return 2 * 1024 * 1024 * 1024; // default 2g
  const num = parseInt(match[1], 10);
  const unit = (match[2] || 'g').toLowerCase();
  if (unit === 'g') return num * 1024 * 1024 * 1024;
  if (unit === 'm') return num * 1024 * 1024;
  if (unit === 'k') return num * 1024;
  return num;
}
