// Phase 10: SSH Connectivity service using ssh2

import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../lib/env.js';

const USER_ID = 1; // Phase 0 placeholder

// Active SSH connections pool
const connections: Map<string, any> = new Map();

async function getSsh2() {
  try {
    return await import('ssh2');
  } catch {
    throw new Error('ssh2 package not available. Run: npm install ssh2');
  }
}

async function getKeyConfig(hostNameOrId: string) {
  const db = await getDb();
  const id = Number(hostNameOrId);
  let rows: any[] = [];
  if (!isNaN(id) && id > 0) {
    rows = await db.select().from(schema.ssh_keys).where(eq(schema.ssh_keys.id, id)).limit(1);
  }
  if (!rows.length) {
    const allKeys = await db.select().from(schema.ssh_keys)
      .where(eq(schema.ssh_keys.user_id, USER_ID))
      .limit(50);
    const match = allKeys.find(r => r.name === hostNameOrId || r.host === hostNameOrId);
    if (match) rows = [match];
    else throw new Error(`SSH key not found: ${hostNameOrId}`);
  }
  return rows[0];
}

function connectToHost(config: any): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const { Client } = await getSsh2();
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', (err: Error) => reject(err));
    const connectOpts: any = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
    };
    if (config.private_key) {
      connectOpts.privateKey = config.private_key;
      if (config.passphrase) connectOpts.passphrase = config.passphrase;
    }
    conn.connect(connectOpts);
  });
}

export async function connect(hostNameOrId: string): Promise<{ connected: boolean; host: string }> {
  const config = await getKeyConfig(hostNameOrId);
  const connKey = `${config.host}:${config.port}:${config.username}`;

  if (connections.has(connKey)) {
    return { connected: true, host: config.host };
  }

  const conn = await connectToHost(config);
  connections.set(connKey, conn);

  // Update last_connected
  const db = await getDb();
  await db.update(schema.ssh_keys).set({ last_connected: new Date() } as any).where(eq(schema.ssh_keys.id, config.id));

  return { connected: true, host: config.host };
}

export async function exec(hostNameOrId: string, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  const config = await getKeyConfig(hostNameOrId);
  const connKey = `${config.host}:${config.port}:${config.username}`;

  let conn = connections.get(connKey);
  if (!conn) {
    conn = await connectToHost(config);
    connections.set(connKey, conn);
  }

  return new Promise((resolve, reject) => {
    conn.exec(command, (err: Error | undefined, stream: any) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      stream.on('close', (code: number) => {
        resolve({ stdout: stdout.slice(0, 50000), stderr: stderr.slice(0, 10000), code: code || 0 });
      });
    });
  });
}

export async function upload(hostNameOrId: string, localPath: string, remotePath: string): Promise<{ uploaded: boolean }> {
  const config = await getKeyConfig(hostNameOrId);
  const connKey = `${config.host}:${config.port}:${config.username}`;

  let conn = connections.get(connKey);
  if (!conn) {
    conn = await connectToHost(config);
    connections.set(connKey, conn);
  }

  const absLocal = path.isAbsolute(localPath) ? localPath : path.join(env.WORKSPACE_DIR, localPath);

  return new Promise((resolve, reject) => {
    conn.sftp((err: Error | undefined, sftp: any) => {
      if (err) return reject(err);
      sftp.fastPut(absLocal, remotePath, (err2: Error | undefined) => {
        sftp.end();
        if (err2) return reject(err2);
        resolve({ uploaded: true });
      });
    });
  });
}

export async function download(hostNameOrId: string, remotePath: string, localPath: string): Promise<{ downloaded: boolean; path: string }> {
  const config = await getKeyConfig(hostNameOrId);
  const connKey = `${config.host}:${config.port}:${config.username}`;

  let conn = connections.get(connKey);
  if (!conn) {
    conn = await connectToHost(config);
    connections.set(connKey, conn);
  }

  const absLocal = path.isAbsolute(localPath) ? localPath : path.join(env.WORKSPACE_DIR, localPath);
  await fs.mkdir(path.dirname(absLocal), { recursive: true });

  return new Promise((resolve, reject) => {
    conn.sftp((err: Error | undefined, sftp: any) => {
      if (err) return reject(err);
      sftp.fastGet(remotePath, absLocal, (err2: Error | undefined) => {
        sftp.end();
        if (err2) return reject(err2);
        resolve({ downloaded: true, path: localPath });
      });
    });
  });
}

export async function disconnect(hostNameOrId: string): Promise<{ disconnected: boolean }> {
  const config = await getKeyConfig(hostNameOrId);
  const connKey = `${config.host}:${config.port}:${config.username}`;
  const conn = connections.get(connKey);
  if (conn) {
    conn.end();
    connections.delete(connKey);
  }
  return { disconnected: true };
}

export async function listKeys(): Promise<any[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.ssh_keys).where(eq(schema.ssh_keys.user_id, USER_ID));
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    host: r.host,
    port: r.port,
    username: r.username,
    fingerprint: r.fingerprint,
    last_connected: r.last_connected?.toISOString() || null,
  }));
}

export async function testConnection(keyId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getKeyConfig(String(keyId));
    const conn = await connectToHost(config);
    conn.end();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
