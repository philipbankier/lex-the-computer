import { getDb, schema } from '../lib/db.js';

export async function buildSystemPrompt(userId: number, opts?: { personaId?: number; tools?: { name: string; description?: string }[]; fileSnippets?: string[] }) {
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where({ id: userId } as any).limit(1);

  let personaPrompt = '';
  if (opts?.personaId) {
    const [persona] = await db.select().from(schema.personas).where({ id: opts.personaId, user_id: userId } as any).limit(1);
    if (persona?.prompt) personaPrompt = persona.prompt;
  } else {
    // try default persona
    const rows = await db.select().from(schema.personas).where({ user_id: userId, is_default: true } as any).limit(1);
    if (rows[0]?.prompt) personaPrompt = rows[0].prompt;
  }

  // active rules
  const activeRules = await db.select().from(schema.rules).where({ user_id: userId, is_active: true } as any);
  const rulesPrompt = activeRules.map((r) => r.prompt).filter(Boolean).join('\n');

  const toolsList = (opts?.tools || []).map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n');
  const files = (opts?.fileSnippets || []).join('\n---\n');

  const parts: string[] = [];
  if (user?.bio) parts.push(`User Bio:\n${user.bio}`);
  if (personaPrompt) parts.push(`Persona:\n${personaPrompt}`);
  if (rulesPrompt) parts.push(`Rules:\n${rulesPrompt}`);
  if (toolsList) parts.push(`Available Tools:\n${toolsList}`);
  if (files) parts.push(`Files:\n${files}`);

  return parts.join('\n\n');
}

