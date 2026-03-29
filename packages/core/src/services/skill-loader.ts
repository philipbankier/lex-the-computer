import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb, schema } from '../lib/db.js';

export interface SkillFrontmatter {
  name: string;
  description: string;
  compatibility?: string[];
  metadata?: {
    author?: string;
    version?: string;
    tags?: string[];
    icon?: string;
  };
  'allowed-tools'?: string[];
}

export interface SkillSummary {
  id: number;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

export interface LoadedSkill {
  id: number;
  name: string;
  description: string;
  fullContent: string;
}

/**
 * Parse SKILL.md frontmatter from raw content.
 * Returns { frontmatter, body } where body is the content after the frontmatter.
 */
export function parseSkillMd(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    return {
      frontmatter: { name: 'unknown', description: '' },
      body: content,
    };
  }

  const fmRaw = fmMatch[1];
  const body = fmMatch[2];

  // Simple YAML-like parsing (no dependency needed for this subset)
  const fm: any = {};
  let currentKey = '';
  let currentArray: string[] | null = null as string[] | null;
  let nestedObj: Record<string, any> | null = null;
  let nestedKey = '';

  for (const line of fmRaw.split('\n')) {
    if (nestedObj && line.match(/^\s{2,}\w/)) {
      const nested = line.trim().match(/^(\w[\w-]*):\s*(.*)$/);
      if (nested) {
        let val: any = nested[2].trim();
        if (val.startsWith('[') && val.endsWith(']')) {
          val = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, ''));
        } else if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        nestedObj[nested[1]] = val;
      }
      continue;
    } else if (nestedObj) {
      fm[nestedKey] = nestedObj;
      nestedObj = null;
      nestedKey = '';
    }

    if (currentArray !== null && line.match(/^\s+-\s/)) {
      currentArray.push(line.replace(/^\s+-\s*/, '').trim().replace(/^["']|["']$/g, ''));
      continue;
    } else if (currentArray !== null) {
      fm[currentKey] = currentArray;
      currentArray = null;
    }

    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value: any = kv[2].trim();

    if (value === '' || value === undefined) {
      // Could be start of nested object or array
      currentKey = key;
      // Peek ahead handled by next iteration
      nestedKey = key;
      nestedObj = {};
      continue;
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, ''));
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    fm[key] = value;
    currentKey = key;
  }

  // Flush trailing
  if (currentArray !== null) fm[currentKey] = currentArray;
  if (nestedObj && Object.keys(nestedObj).length > 0) fm[nestedKey] = nestedObj;

  return {
    frontmatter: fm as SkillFrontmatter,
    body,
  };
}

/**
 * Get summaries of all active skills for a user (always in AI context).
 */
export async function getActiveSkillSummaries(userId: number): Promise<SkillSummary[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.skills).where({ user_id: userId, is_active: true } as any);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    icon: r.icon || '\u2699\uFE0F',
    isActive: r.is_active,
  }));
}

/**
 * Load the full SKILL.md content for skills whose descriptions match the user message.
 * Simple keyword matching: if any word from the skill description appears in the message.
 */
export async function matchAndLoadSkills(userId: number, userMessage: string): Promise<LoadedSkill[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.skills).where({ user_id: userId, is_active: true } as any);

  const msgLower = userMessage.toLowerCase();
  const msgWords = new Set(msgLower.split(/\s+/).filter((w) => w.length > 3));

  const matched: LoadedSkill[] = [];

  for (const skill of rows) {
    if (!skill.directory) continue;
    const desc = (skill.description || '').toLowerCase();
    const name = skill.name.toLowerCase();

    // Match if: skill name appears in message, or significant description keywords overlap
    const descWords = desc.split(/\s+/).filter((w) => w.length > 3);
    const nameMatch = msgLower.includes(name);
    const keywordOverlap = descWords.filter((w) => msgWords.has(w)).length;

    if (nameMatch || keywordOverlap >= 2) {
      try {
        const content = await fs.readFile(path.join(skill.directory, 'SKILL.md'), 'utf8');
        matched.push({
          id: skill.id,
          name: skill.name,
          description: skill.description || '',
          fullContent: content,
        });
      } catch {
        // SKILL.md missing, skip
      }
    }
  }

  return matched;
}

/**
 * Build the skills context section for the AI system prompt.
 * Level 1: Always include skill summaries
 * Level 2: Include full SKILL.md for matched skills
 */
export async function buildSkillsContext(userId: number, userMessage: string): Promise<string> {
  const summaries = await getActiveSkillSummaries(userId);
  if (summaries.length === 0) return '';

  const parts: string[] = [];

  // Level 1: Always include list of available skills
  const summaryList = summaries
    .map((s) => `- ${s.icon} ${s.name}: ${s.description}`)
    .join('\n');
  parts.push(`Available Skills:\n${summaryList}`);

  // Level 2: Load full content for matched skills
  const matched = await matchAndLoadSkills(userId, userMessage);
  if (matched.length > 0) {
    for (const skill of matched) {
      const { body } = parseSkillMd(skill.fullContent);
      parts.push(`Active Skill — ${skill.name}:\n${body.trim()}`);
    }
  }

  return parts.join('\n\n');
}
