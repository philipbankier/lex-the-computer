import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from '../db/schema.js';
import { env } from './env.js';

const { Client } = pkg;

let _client: InstanceType<typeof Client> | null = null;

export function getClient() {
  if (_client) return _client;
  if (!env.DATABASE_URL) throw new Error('Missing DATABASE_URL');
  _client = new Client({ connectionString: env.DATABASE_URL });
  return _client;
}

export async function getDb() {
  const client = getClient();
  // Lazily connect; reuse same client
  // @ts-ignore detect connected via any
  if (!(client as any)._connected) {
    await client.connect();
    // mark flag
    (client as any)._connected = true;
  }
  return drizzle(client, { schema });
}

export type DB = Awaited<ReturnType<typeof getDb>>;
export { schema };

