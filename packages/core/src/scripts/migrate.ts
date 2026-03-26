import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from '../db/schema.js';

const { Client } = pkg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  const db = drizzle(client, { schema });
  await db.execute('CREATE TABLE IF NOT EXISTS migrations (id text primary key, run_at timestamptz default now())');

  const dir = path.resolve(process.cwd(), 'packages/core/migrations');
  if (!fs.existsSync(dir)) {
    console.log('No migrations directory');
    await client.end();
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const id = file;
    const exists = await client.query('SELECT 1 FROM migrations WHERE id=$1 LIMIT 1', [id]);
    if (exists.rowCount) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log('Applying migration', id);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO migrations (id) VALUES ($1)', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }
  console.log('Migrations complete');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
