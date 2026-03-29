import { getDb, schema } from '../lib/db.js';
import { eq, sql, and, gte } from 'drizzle-orm';

export type UsageType = 'ai_tokens' | 'storage' | 'api_calls' | 'image_gen' | 'video_gen' | 'transcription';

export async function recordUsage(userId: number, type: UsageType, amount: number, metadata?: Record<string, any>) {
  const db = await getDb();
  await db.insert(schema.usage_records).values({
    user_id: userId,
    type,
    amount,
    metadata: metadata || null,
  });
}

export async function getUserUsage(userId: number, since?: Date): Promise<Record<string, number>> {
  const db = await getDb();
  const cutoff = since || new Date(new Date().setDate(1)); // default: this month

  const rows = await db.select({
    type: schema.usage_records.type,
    total: sql<number>`sum(${schema.usage_records.amount})`,
  })
    .from(schema.usage_records)
    .where(and(
      eq(schema.usage_records.user_id, userId),
      gte(schema.usage_records.created_at, cutoff),
    ))
    .groupBy(schema.usage_records.type);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.type] = Number(row.total) || 0;
  }
  return result;
}

export async function getAllUsage(since?: Date): Promise<Array<{ userId: number; type: string; total: number }>> {
  const db = await getDb();
  const cutoff = since || new Date(new Date().setDate(1));

  return db.select({
    userId: schema.usage_records.user_id,
    type: schema.usage_records.type,
    total: sql<number>`sum(${schema.usage_records.amount})`,
  })
    .from(schema.usage_records)
    .where(gte(schema.usage_records.created_at, cutoff))
    .groupBy(schema.usage_records.user_id, schema.usage_records.type);
}
