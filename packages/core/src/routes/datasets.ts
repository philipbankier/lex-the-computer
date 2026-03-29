import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq, desc } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env.js';

export const datasetsRouter = new Hono();
const userIdFromCtx = () => 1;

// List datasets
datasetsRouter.get('/', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const rows = await db.select().from(schema.datasets)
    .where(eq(schema.datasets.user_id, id))
    .orderBy(desc(schema.datasets.created_at));
  return c.json(rows);
});

// Get dataset details
datasetsRouter.get('/:id', async (c) => {
  const db = await getDb();
  const dsId = parseInt(c.req.param('id'));
  const [ds] = await db.select().from(schema.datasets).where(eq(schema.datasets.id, dsId)).limit(1);
  if (!ds) return c.json({ error: 'Not found' }, 404);
  return c.json(ds);
});

// Create dataset from CSV/JSON upload
datasetsRouter.post('/', async (c) => {
  const db = await getDb();
  const id = userIdFromCtx();
  const body = await c.req.json();
  const { name, description, data, filename } = body;

  if (!name || !data) return c.json({ error: 'name and data required' }, 400);

  const dsDir = path.join(env.WORKSPACE_DIR, 'datasets');
  await fs.mkdir(dsDir, { recursive: true });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const dbPath = path.join(dsDir, `${slug}.duckdb`);

  try {
    // Write the raw data to a temp file for DuckDB to ingest
    const ext = (filename || 'data.csv').split('.').pop()?.toLowerCase() || 'csv';
    const tmpFile = path.join(dsDir, `_tmp_${slug}.${ext}`);
    await fs.writeFile(tmpFile, data, 'utf8');

    // Use DuckDB to ingest data
    const duckdb = await import('duckdb-async');
    const ddb = await duckdb.Database.create(dbPath);
    const conn = await ddb.connect();

    let tableName = 'data';
    if (ext === 'json') {
      await conn.run(`CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${tmpFile}')`);
    } else {
      await conn.run(`CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${tmpFile}')`);
    }

    // Get schema and row count
    const schemaRows = await conn.all(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='${tableName}'`);
    const countRows = await conn.all(`SELECT count(*) as cnt FROM "${tableName}"`);
    const rowCount = Number(countRows[0]?.cnt || 0);

    await conn.close();
    await ddb.close();

    // Clean up temp file
    await fs.unlink(tmpFile).catch(() => {});

    const schemaDef = schemaRows.map((r: any) => ({ name: r.column_name, type: r.data_type }));

    const [ds] = await db.insert(schema.datasets).values({
      user_id: id,
      name,
      description: description || '',
      source: filename || 'upload',
      schema_def: schemaDef,
      row_count: rowCount,
      file_path: dbPath,
    } as any).returning();

    return c.json(ds);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete dataset
datasetsRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const dsId = parseInt(c.req.param('id'));
  const [ds] = await db.select().from(schema.datasets).where(eq(schema.datasets.id, dsId)).limit(1);
  if (!ds) return c.json({ error: 'Not found' }, 404);

  // Delete DuckDB file
  if (ds.file_path) {
    await fs.unlink(ds.file_path).catch(() => {});
  }

  await db.delete(schema.datasets).where(eq(schema.datasets.id, dsId));
  return c.json({ ok: true });
});

// Run SQL query against dataset
datasetsRouter.post('/:id/query', async (c) => {
  const db = await getDb();
  const dsId = parseInt(c.req.param('id'));
  const [ds] = await db.select().from(schema.datasets).where(eq(schema.datasets.id, dsId)).limit(1);
  if (!ds) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json();
  const { sql } = body;
  if (!sql) return c.json({ error: 'sql required' }, 400);

  try {
    const duckdb = await import('duckdb-async');
    const ddb = await duckdb.Database.create(ds.file_path!);
    const conn = await ddb.connect();
    const rows = await conn.all(sql);
    await conn.close();
    await ddb.close();
    return c.json({ rows, columns: rows.length > 0 ? Object.keys(rows[0]) : [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Preview first 100 rows
datasetsRouter.get('/:id/preview', async (c) => {
  const db = await getDb();
  const dsId = parseInt(c.req.param('id'));
  const [ds] = await db.select().from(schema.datasets).where(eq(schema.datasets.id, dsId)).limit(1);
  if (!ds) return c.json({ error: 'Not found' }, 404);

  try {
    const duckdb = await import('duckdb-async');
    const ddb = await duckdb.Database.create(ds.file_path!);
    const conn = await ddb.connect();
    const rows = await conn.all('SELECT * FROM data LIMIT 100');
    await conn.close();
    await ddb.close();
    return c.json({ rows, columns: rows.length > 0 ? Object.keys(rows[0]) : [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
