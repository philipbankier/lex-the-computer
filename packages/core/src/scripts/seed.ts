import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from '../db/schema.js';
import pkg from 'pg';

const { Client } = pkg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  const db = drizzle(client);

  const email = process.env.SEED_USER_EMAIL || 'test@example.com';
  const name = 'Test User';
  await db
    .insert(users)
    .values({ email, name })
    .onConflictDoNothing();

  console.log('Seed complete. User:', email);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

