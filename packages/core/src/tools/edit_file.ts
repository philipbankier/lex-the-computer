import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolDefinition } from './types.js';
import { env } from '../lib/env.js';

type Edit =
  | { type: 'replace'; find: string; replace: string; flags?: string }
  | { type: 'insert_after'; anchor: string; insert: string }
  | { type: 'insert_before'; anchor: string; insert: string };

export const editFile: ToolDefinition<{ path: string; edits: Edit[] }> = {
  name: 'edit_file',
  description: 'Edit a file by applying simple find/replace or anchor-based inserts',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      edits: { type: 'array', items: { type: 'object' } },
    },
    required: ['path', 'edits'],
  },
  async execute({ path: rel, edits }) {
    const abs = path.resolve(env.WORKSPACE_DIR, rel);
    const relOut = path.relative(env.WORKSPACE_DIR, abs);
    if (relOut.startsWith('..') || path.isAbsolute(relOut)) throw new Error('invalid path');
    let data = await fs.readFile(abs, 'utf8');
    for (const e of edits) {
      if ((e as any).type === 'replace') {
        const { find, replace, flags } = e as any;
        const re = new RegExp(find, flags || 'g');
        data = data.replace(re, replace);
      } else if ((e as any).type === 'insert_after') {
        const { anchor, insert } = e as any;
        data = data.replace(anchor, `${anchor}${insert}`);
      } else if ((e as any).type === 'insert_before') {
        const { anchor, insert } = e as any;
        data = data.replace(anchor, `${insert}${anchor}`);
      }
    }
    await fs.writeFile(abs, data, 'utf8');
    return { ok: true, path: relOut, length: data.length };
  },
};

