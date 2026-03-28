import { ToolDefinition } from './types.js';
import { runCommand } from './run_command.js';

export const runSequentialCommands: ToolDefinition<{ commands: string[] }> = {
  name: 'run_sequential_commands',
  description: 'Run multiple shell commands in sequence; stop on first failure',
  parameters: {
    type: 'object',
    properties: { commands: { type: 'array', items: { type: 'string' } } },
    required: ['commands'],
  },
  async execute({ commands }) {
    const results: any[] = [];
    for (const cmd of commands) {
      const r = await runCommand.execute({ cmd });
      results.push({ cmd, ...r });
      if ((r as any).exitCode && (r as any).exitCode !== 0) break;
    }
    return { results };
  },
};

