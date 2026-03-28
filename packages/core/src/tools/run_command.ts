import { exec } from 'node:child_process';
import path from 'node:path';
import { env } from '../lib/env.js';
import { ToolDefinition } from './types.js';

export const runCommand: ToolDefinition<{ cmd: string }> = {
  name: 'run_command',
  description: 'Execute a shell command within the workspace directory',
  parameters: {
    type: 'object',
    properties: { cmd: { type: 'string' } },
    required: ['cmd'],
  },
  async execute({ cmd }) {
    // Sandbox: reject attempts to change directory outside workspace
    if (/\b(cd|pushd)\b/.test(cmd)) return { error: 'cd not allowed; commands run in workspace root' };
    return await new Promise((resolve) => {
      exec(cmd, { cwd: env.WORKSPACE_DIR, timeout: 30000, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
        resolve({ stdout, stderr, exitCode: (error as any)?.code ?? 0 });
      });
    });
  },
};

