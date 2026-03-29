// Skills tools — filesystem-first with AgentSkills spec compliance
// Skills live at workspace/Skills/<skill-name>/SKILL.md
// DB is a cache/index that syncs from filesystem

import { ToolDefinition } from './types.js';
import { getDb, schema } from '../lib/db.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env.js';

// Skills directory: workspace/Skills/ (capital S per AgentSkills spec)
const skillsBase = () => path.join(env.WORKSPACE_DIR, 'Skills');

export const createSkillTool: ToolDefinition<{ name: string; description?: string; allowed_tools?: string[] }> = {
  name: 'create_skill',
  description: 'Create a new skill with a directory structure and SKILL.md template (AgentSkills spec)',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill name (display name)' },
      description: { type: 'string', description: 'What this skill does' },
      allowed_tools: { type: 'array', items: { type: 'string' }, description: 'Tools this skill can use' },
    },
    required: ['name'],
  },
  async execute({ name, description, allowed_tools }) {
    const db = await getDb();
    const user_id = 1;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const dir = path.join(skillsBase(), slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.mkdir(path.join(dir, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(dir, 'references'), { recursive: true });
    await fs.mkdir(path.join(dir, 'assets'), { recursive: true });

    const desc = description || 'A custom skill';
    const toolsList = allowed_tools && allowed_tools.length > 0
      ? `[${allowed_tools.join(', ')}]`
      : '[]';

    const skillMd = `---
name: ${slug}
description: ${desc}
compatibility:
  - lex
metadata:
  author: user
  version: 1.0.0
  tags: []
  icon: "\u2699\uFE0F"
allowed-tools: ${toolsList}
---

# ${name}

Add your skill instructions here.
`;
    await fs.writeFile(path.join(dir, 'SKILL.md'), skillMd, 'utf8');

    // Sync to DB (cache/index)
    const [row] = await db.insert(schema.skills).values({
      user_id, name, description: desc, author: 'user', version: '1.0.0',
      icon: '\u2699\uFE0F', directory: dir, source: 'local', is_active: true,
    } as any).returning();

    return { ok: true, skill: row, path: dir };
  },
};

export const listSkillsTool: ToolDefinition<{}> = {
  name: 'list_skills',
  description: 'List all installed skills with their status',
  parameters: { type: 'object', properties: {} },
  async execute() {
    const db = await getDb();
    const user_id = 1;

    // Sync from filesystem: scan Skills/ directory for any new skills
    try {
      const base = skillsBase();
      await fs.mkdir(base, { recursive: true });
      const dirs = await fs.readdir(base, { withFileTypes: true });
      const dbSkills = await db.select().from(schema.skills).where({ user_id } as any);
      const dbDirs = new Set(dbSkills.map(s => s.directory));

      for (const entry of dirs) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(base, entry.name);
        if (dbDirs.has(dir)) continue;

        // Found a skill on disk not in DB — sync it
        const skillMdPath = path.join(dir, 'SKILL.md');
        try {
          const content = await fs.readFile(skillMdPath, 'utf8');
          const { parseSkillMd } = await import('../services/skill-loader.js');
          const { frontmatter } = parseSkillMd(content);
          await db.insert(schema.skills).values({
            user_id, name: frontmatter.name || entry.name,
            description: frontmatter.description || '',
            author: frontmatter.metadata?.author || 'user',
            version: frontmatter.metadata?.version || '1.0.0',
            icon: frontmatter.metadata?.icon || '\u2699\uFE0F',
            directory: dir, source: 'local', is_active: true,
          } as any);
        } catch {
          // No valid SKILL.md, skip
        }
      }
    } catch {}

    const rows = await db.select().from(schema.skills).where({ user_id } as any);
    return {
      skills: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        icon: r.icon,
        source: r.source,
        isActive: r.is_active,
      })),
    };
  },
};

export const getSkillTool: ToolDefinition<{ id?: number; name?: string }> = {
  name: 'get_skill',
  description: 'Get full details of a skill including its SKILL.md content',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Skill ID' },
      name: { type: 'string', description: 'Skill name (alternative to id)' },
    },
  },
  async execute({ id, name }) {
    const db = await getDb();
    const user_id = 1;
    let row: any;
    if (id) {
      row = (await db.select().from(schema.skills).where({ id } as any).limit(1))[0];
    } else if (name) {
      const rows = await db.select().from(schema.skills).where({ user_id } as any);
      row = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
    }
    if (!row) return { error: 'Skill not found' };

    let skillMdContent = '';
    if (row.directory) {
      try { skillMdContent = await fs.readFile(path.join(row.directory, 'SKILL.md'), 'utf8'); } catch {}
    }
    return { skill: row, skillMdContent };
  },
};

export const toggleSkillTool: ToolDefinition<{ id?: number; name?: string; active: boolean }> = {
  name: 'toggle_skill',
  description: 'Enable or disable a skill',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Skill ID' },
      name: { type: 'string', description: 'Skill name (alternative to id)' },
      active: { type: 'boolean', description: 'true to enable, false to disable' },
    },
    required: ['active'],
  },
  async execute({ id, name, active }) {
    const db = await getDb();
    const user_id = 1;
    let skillId = id;
    if (!skillId && name) {
      const rows = await db.select().from(schema.skills).where({ user_id } as any);
      const found = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
      if (found) skillId = found.id;
    }
    if (!skillId) return { error: 'Skill not found' };
    const [row] = await db.update(schema.skills).set({ is_active: active, updated_at: new Date() } as any).where({ id: skillId } as any).returning();
    return { ok: true, skill: row };
  },
};

export const installHubSkillTool: ToolDefinition<{ hub_skill_id?: number; name?: string }> = {
  name: 'install_hub_skill',
  description: 'Install a skill from the Skills Hub to workspace/Skills/ directory',
  parameters: {
    type: 'object',
    properties: {
      hub_skill_id: { type: 'number', description: 'Hub skill ID' },
      name: { type: 'string', description: 'Hub skill name (alternative to id)' },
    },
  },
  async execute({ hub_skill_id, name }) {
    const db = await getDb();
    const user_id = 1;

    let hubSkill: any;
    if (hub_skill_id) {
      hubSkill = (await db.select().from(schema.skills_hub).where({ id: hub_skill_id } as any).limit(1))[0];
    } else if (name) {
      const all = await db.select().from(schema.skills_hub);
      hubSkill = all.find((r) => r.name.toLowerCase() === name.toLowerCase());
    }
    if (!hubSkill) return { error: 'Hub skill not found' };

    const existing = (await db.select().from(schema.skills).where({ user_id, hub_id: hubSkill.id } as any).limit(1))[0];
    if (existing) return { error: 'Already installed', skill: existing };

    // Install to workspace/Skills/ directory
    const slug = hubSkill.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const dir = path.join(skillsBase(), slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.mkdir(path.join(dir, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(dir, 'references'), { recursive: true });
    await fs.mkdir(path.join(dir, 'assets'), { recursive: true });

    if (hubSkill.skill_md) await fs.writeFile(path.join(dir, 'SKILL.md'), hubSkill.skill_md, 'utf8');
    if (hubSkill.readme) await fs.writeFile(path.join(dir, 'README.md'), hubSkill.readme, 'utf8');

    const [row] = await db.insert(schema.skills).values({
      user_id, name: hubSkill.name, description: hubSkill.description,
      author: hubSkill.author, version: hubSkill.version, icon: hubSkill.icon,
      directory: dir, source: 'hub', hub_id: hubSkill.id, is_active: true,
    } as any).returning();

    await db.update(schema.skills_hub).set({ downloads: (hubSkill.downloads || 0) + 1 } as any).where({ id: hubSkill.id } as any);
    return { ok: true, skill: row };
  },
};

export const uninstallSkillTool: ToolDefinition<{ id?: number; name?: string }> = {
  name: 'uninstall_skill',
  description: 'Uninstall a skill (removes from workspace/Skills/ directory and database)',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Skill ID' },
      name: { type: 'string', description: 'Skill name (alternative to id)' },
    },
  },
  async execute({ id, name }) {
    const db = await getDb();
    const user_id = 1;
    let row: any;
    if (id) {
      row = (await db.select().from(schema.skills).where({ id } as any).limit(1))[0];
    } else if (name) {
      const rows = await db.select().from(schema.skills).where({ user_id } as any);
      row = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
    }
    if (!row) return { error: 'Skill not found' };

    // Remove from filesystem
    if (row.directory) {
      try { await fs.rm(row.directory, { recursive: true, force: true }); } catch {}
    }
    // Remove from DB cache
    await db.delete(schema.skills).where({ id: row.id } as any);
    return { ok: true };
  },
};

export const searchHubSkillsTool: ToolDefinition<{ query?: string; tags?: string[] }> = {
  name: 'search_hub_skills',
  description: 'Search the Skills Hub for available skills to install',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (matches name, description)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
    },
  },
  async execute({ query, tags }) {
    const db = await getDb();
    let rows = await db.select().from(schema.skills_hub);

    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((r) => `${r.name} ${r.description || ''}`.toLowerCase().includes(q));
    }
    if (tags && tags.length > 0) {
      const filterTags = tags.map((t) => t.toLowerCase());
      rows = rows.filter((r) => {
        const skillTags: string[] = r.tags ? JSON.parse(r.tags) : [];
        return filterTags.some((ft) => skillTags.map((t) => t.toLowerCase()).includes(ft));
      });
    }

    return {
      skills: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        author: r.author,
        icon: r.icon,
        tags: r.tags ? JSON.parse(r.tags) : [],
        downloads: r.downloads,
      })),
    };
  },
};
