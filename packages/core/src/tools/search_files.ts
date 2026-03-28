import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolDefinition } from './types.js';
import { env } from '../lib/env.js';

export const searchFilesTool: ToolDefinition<{ q: string; type?: 'content' | 'filename' }> = {
  name: 'search_files',
  description: 'Search file contents or filenames within the workspace',
  parameters: {
    type: 'object',
    properties: { q: { type: 'string' }, type: { type: 'string', enum: ['content', 'filename'] } },
    required: ['q'],
  },
  async execute({ q, type = 'content' }) {
    if (!q) return { results: [] };
    if (type === 'filename') {
      const results: any[] = [];
      const walk = async (dir: string) => {
        const ents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as any[]);
        for (const e of ents) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) await walk(full);
          else if (e.isFile() && e.name.toLowerCase().includes(q.toLowerCase())) results.push({ path: path.relative(env.WORKSPACE_DIR, full) });
        }
      };
      await walk(env.WORKSPACE_DIR);
      return { results };
    }
    const cmd = `grep -RIn --exclude-dir=.git ${JSON.stringify(q)} ${JSON.stringify(env.WORKSPACE_DIR)}`;
    return await new Promise((resolve) => {
      exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout) => {
        if (err && (err as any).code !== 1) return resolve({ results: [], error: 'grep failed' });
        const lines = stdout.split('\n').filter(Boolean);
        const results = lines.map((line) => {
          const [file, lineNo, ...rest] = line.split(':');
          return { path: path.relative(env.WORKSPACE_DIR, file), line: Number(lineNo), text: rest.join(':') };
        });
        resolve({ results });
      });
    });
  },
};

