import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolDefinition } from './types.js';
import { env } from '../lib/env.js';

export const listFilesTool: ToolDefinition<{ path?: string }> = {
  name: 'list_files',
  description: 'List files and directories under a path in the workspace',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' } },
  },
  async execute({ path: rel = '' }) {
    const dir = path.resolve(env.WORKSPACE_DIR, rel);
    const relOut = path.relative(env.WORKSPACE_DIR, dir);
    if (relOut.startsWith('..') || path.isAbsolute(relOut)) throw new Error('invalid path');
    const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as any[]);
    const rows = await Promise.all(
      ents.map(async (e) => {
        const full = path.join(dir, e.name);
        const st = await fs.stat(full).catch(() => null as any);
        return {
          name: e.name,
          path: path.relative(env.WORKSPACE_DIR, full),
          type: e.isDirectory() ? 'dir' : e.isFile() ? 'file' : 'other',
          size: st?.size ?? 0,
          modified: st?.mtime?.toISOString?.() || null,
        };
      })
    );
    return { entries: rows };
  },
};

