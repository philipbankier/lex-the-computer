import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolDefinition } from './types.js';
import { env } from '../lib/env.js';

export const createFile: ToolDefinition<{ path: string; content: string }> = {
  name: 'create_file',
  description: 'Create or overwrite a file at the given path in the workspace',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' }, content: { type: 'string' } },
    required: ['path', 'content'],
  },
  async execute({ path: rel, content }) {
    const abs = path.resolve(env.WORKSPACE_DIR, rel);
    const relOut = path.relative(env.WORKSPACE_DIR, abs);
    if (relOut.startsWith('..') || path.isAbsolute(relOut)) throw new Error('invalid path');
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    return { ok: true, path: relOut, bytes: Buffer.byteLength(content) };
  },
};

